package resource

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"strings"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var tenantGVR = schema.GroupVersionResource{
	Group:    "cloud.grafana.com",
	Version:  "v1alpha1",
	Resource: "tenants",
}

const (
	labelPendingDelete           = "cloud.grafana.com/pending-delete"
	annotationPendingDeleteAfter = "cloud.grafana.com/pending-delete-after"

	editLabelMaxAttempts   = 4
	editLabelMaxRetryDelay = 2 * time.Second

	defaultPollInterval = 1 * time.Hour
	pollPageSize        = 2000
)

// TenantWatcher watches Tenant CRDs and syncs pending-delete state to the KV
// store. It runs either a Kubernetes informer or a periodic polling loop
// depending on config.
type TenantWatcher struct {
	log                log.Logger
	pendingDeleteStore *PendingDeleteStore
	dataStore          *dataStore
	writeEvent         EventAppender
	ctx                context.Context
	stopCh             chan struct{}
	retryMaxDelay      time.Duration
	// Informer-path state. Nil when UsePolling is true.
	factory dynamicinformer.DynamicSharedInformerFactory
	// Polling-path state. Nil when UsePolling is false.
	client       dynamic.Interface
	pollInterval time.Duration
}

// TenantWatcherConfig holds configuration for the TenantWatcher.
type TenantWatcherConfig struct {
	// TenantAPIServerURL is the URL of the app-platform API server serving Tenant CRDs.
	TenantAPIServerURL string
	// Token is the system token used to sign access tokens.
	Token string
	// TokenExchangeURL is the URL used to exchange the system token for an access token.
	TokenExchangeURL string
	// CAFile is the path to a PEM-encoded CA certificate bundle for verifying the tenant API server.
	CAFile string
	// AllowInsecure skips TLS verification (for local dev).
	AllowInsecure bool
	// ResyncInterval is how often the informer re-lists all tenants.
	ResyncInterval time.Duration
	// RetryMaxDelay is the maximum delay between retries in case of write conflicts when updating resource labels.
	RetryMaxDelay time.Duration
	// UsePolling selects the periodic polling strategy instead of a Kubernetes
	// informer. Better memory usage than informer since informer reads all pending delete tenants into cache.
	// Polling is only memory bound by page size.
	UsePolling bool
	// PollInterval is the delay between poll cycles when UsePolling is true.
	// Defaults to 5 minutes if zero.
	PollInterval time.Duration
	Log          log.Logger
}

// NewTenantWatcherConfig creates TenantWatcherConfig from Grafana settings and returns nil
// when required settings are missing.
func NewTenantWatcherConfig(cfg *setting.Cfg) *TenantWatcherConfig {
	logger := log.New("tenant-watcher")

	if cfg == nil {
		logger.Info("tenant watcher not initialized, config is nil")
		return nil
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	tenantWatcherCfg := &TenantWatcherConfig{
		TenantAPIServerURL: strings.TrimSpace(cfg.TenantApiServerAddress),
		Token:              strings.TrimSpace(grpcSection.Key("token").MustString("")),
		TokenExchangeURL:   strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString("")),
		CAFile:             strings.TrimSpace(cfg.TenantWatcherCAFile),
		AllowInsecure:      cfg.TenantWatcherAllowInsecureTLS,
		UsePolling:         cfg.TenantWatcherUsePolling,
		PollInterval:       cfg.TenantWatcherPollInterval,
		Log:                logger,
	}

	if tenantWatcherCfg.TenantAPIServerURL == "" || tenantWatcherCfg.Token == "" || tenantWatcherCfg.TokenExchangeURL == "" {
		logger.Warn("tenant watcher not valid - ensure tenant api address, token, and token exchange url are set")
		return nil
	}

	return tenantWatcherCfg
}

// bearerTokenExchangeRT is an http.RoundTripper that exchanges a fresh token
// on every request and sets it in the standard Authorization header.
type bearerTokenExchangeRT struct {
	exchanger authnlib.TokenExchanger
	audience  string
	namespace string
	next      http.RoundTripper
}

func (rt *bearerTokenExchangeRT) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := rt.exchanger.Exchange(req.Context(), authnlib.TokenExchangeRequest{
		Audiences: []string{rt.audience},
		Namespace: rt.namespace,
	})
	if err != nil {
		return nil, fmt.Errorf("exchanging token: %w", err)
	}
	req = utilnet.CloneRequest(req)
	req.Header.Set("Authorization", "Bearer "+resp.Token)
	return rt.next.RoundTrip(req)
}

// newBearerTokenExchangeWrapper returns a transport.WrapperFunc for use with
// rest.Config.WrapTransport that exchanges a fresh token on every request.
func newBearerTokenExchangeWrapper(exchanger authnlib.TokenExchanger, audience, namespace string) transport.WrapperFunc {
	return func(rt http.RoundTripper) http.RoundTripper {
		return &bearerTokenExchangeRT{exchanger: exchanger, audience: audience, namespace: namespace, next: rt}
	}
}

// NewTenantRESTConfig creates a rest.Config that authenticates to the
// app-platform API server using a signed access token sent via the
// Authorization header.
func NewTenantRESTConfig(cfg TenantWatcherConfig) (*rest.Config, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
			}},
		))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("creating token exchange client: %w", err)
	}

	restCfg := &rest.Config{
		Host:          cfg.TenantAPIServerURL,
		WrapTransport: newBearerTokenExchangeWrapper(tc, "cloud.grafana.com", "*"),
		TLSClientConfig: rest.TLSClientConfig{
			CAFile:   cfg.CAFile,
			Insecure: cfg.AllowInsecure && cfg.CAFile == "",
		},
	}

	return restCfg, nil
}

// NewTenantWatcher creates and starts a TenantWatcher.
func NewTenantWatcher(ctx context.Context, ds *dataStore, writeEvent EventAppender, cfg TenantWatcherConfig) (*TenantWatcher, error) {
	restCfg, err := NewTenantRESTConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building tenant REST config: %w", err)
	}

	logger := cfg.Log
	if logger == nil {
		logger = log.NewNopLogger()
	}

	resync := cfg.ResyncInterval
	if resync <= 0 {
		resync = 1 * time.Hour
	}

	retryMaxDelay := cfg.RetryMaxDelay
	if retryMaxDelay <= 0 {
		retryMaxDelay = editLabelMaxRetryDelay
	}

	client, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	tw := &TenantWatcher{
		log:                logger,
		pendingDeleteStore: newPendingDeleteStore(ds.kv),
		dataStore:          ds,
		writeEvent:         writeEvent,
		ctx:                ctx,
		stopCh:             make(chan struct{}),
		retryMaxDelay:      retryMaxDelay,
	}

	if cfg.UsePolling {
		interval := cfg.PollInterval
		if interval <= 0 {
			interval = defaultPollInterval
		}
		tw.client = client
		tw.pollInterval = interval
		go tw.startPolling(ctx)
		logger.Info("tenant watcher started", "strategy", "polling", "poll_interval", interval)
		return tw, nil
	}

	if err := tw.startInformer(client, resync); err != nil {
		return nil, err
	}
	logger.Info("tenant watcher started", "strategy", "informer")

	return tw, nil
}

func (tw *TenantWatcher) startInformer(client dynamic.Interface, resync time.Duration) error {
	// Only watch tenants currently labeled pending-delete. At prod scale the full
	// tenant set is too large to cache as unstructured objects; filtering server-side
	// keeps the informer working set bounded to the pending-delete cohort.
	tw.factory = dynamicinformer.NewFilteredDynamicSharedInformerFactory(client, resync, metav1.NamespaceAll, func(opts *metav1.ListOptions) {
		opts.LabelSelector = labelPendingDelete + "=true"
	})
	informer := tw.factory.ForResource(tenantGVR).Informer()

	_, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			tw.handleTenant(obj.(*unstructured.Unstructured))
		},
		UpdateFunc: func(_, newObj interface{}) {
			tw.handleTenant(newObj.(*unstructured.Unstructured))
		},
		// With a label selector, both a real tenant delete and a label removal
		// arrive here as "delete" events.
		DeleteFunc: func(obj interface{}) {
			tenant, ok := obj.(*unstructured.Unstructured)
			if !ok {
				return
			}
			// deletionTimestamp set → tenant is being graceful-deleted (finalizer flow).
			// Label still present → server emitted DELETE because object was deleted,
			// not because it stopped matching the selector.
			if tenant.GetDeletionTimestamp() != nil || tenant.GetLabels()[labelPendingDelete] == "true" {
				return
			}
			tw.clearTenantPendingDelete(tenant.GetName())
		},
	})
	if err != nil {
		return err
	}

	tw.factory.Start(tw.stopCh)

	// Catch tenants whose pending-delete label was cleared while the pod was
	// down: the label-selected LIST won't include them, so they never generate
	// a delete event. After the informer syncs, diff its cache against the KV
	// store and clear anything that's no longer live.
	go tw.reconcileStaleRecordsOnStartup(informer)

	return nil
}

func (tw *TenantWatcher) startPolling(ctx context.Context) {
	tw.runPollCycle(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-tw.stopCh:
			return
		case <-time.After(tw.pollInterval):
			tw.runPollCycle(ctx)
		}
	}
}

// runPollCycle does one poll cycle: paginated LIST of pending-delete tenants,
// reconcile each, then clear KV records for tenants that dropped out of the
// filtered view. Memory is bounded to one page plus the liveNames set.
func (tw *TenantWatcher) runPollCycle(ctx context.Context) {
	start := time.Now()
	liveNames := make(map[string]struct{})

	var continueToken string
	var pageCount int
	for {
		select {
		case <-ctx.Done():
			return
		case <-tw.stopCh:
			return
		default:
		}

		page, err := tw.client.Resource(tenantGVR).List(ctx, metav1.ListOptions{
			Limit:         pollPageSize,
			Continue:      continueToken,
			LabelSelector: labelPendingDelete + "=true",
		})
		if err != nil {
			tw.log.Error("tenant watcher poll cycle: list failed, skipping clear phase",
				"error", err, "pages_so_far", pageCount, "names_so_far", len(liveNames))
			return
		}
		pageCount++
		for i := range page.Items {
			item := &page.Items[i]
			liveNames[item.GetName()] = struct{}{}
			tw.handleTenant(item)
		}
		continueToken = page.GetContinue()
		if continueToken == "" {
			break
		}
	}

	listDuration := time.Since(start)

	// An empty list should never happen. If it does something is very wrong, and we don't want to nuke all the
	// pending delete records as a consequence.
	if len(liveNames) == 0 {
		tw.log.Warn("tenant watcher poll cycle: zero live tenants, skipping clear phase",
			"pages", pageCount, "list_duration", listDuration)
		return
	}

	// Go through all pending delete records
	// If they're in the set
	clearStart := time.Now()
	var cleared, leftForDeleter, scanned int
	for name, err := range tw.pendingDeleteStore.Names(ctx) {
		if err != nil {
			tw.log.Error("tenant watcher poll cycle: failed to list kv records", "error", err)
			return
		}
		scanned++
		if _, live := liveNames[name]; live {
			continue
		}
		_, err = tw.client.Resource(tenantGVR).Get(ctx, name, metav1.GetOptions{})
		// if not found then the tenant was deleted in the tenant api - so keep the record
		if apierrors.IsNotFound(err) {
			leftForDeleter++
			continue
		}
		if err != nil {
			tw.log.Warn("tenant watcher poll cycle: failed to check tenant existence, leaving record",
				"tenant", name, "error", err)
			leftForDeleter++
			continue
		}
		tw.clearTenantPendingDelete(name)
		cleared++
	}

	tw.log.Info("tenant watcher poll cycle complete",
		"live_tenants", len(liveNames),
		"pages", pageCount,
		"kv_records_scanned", scanned,
		"cleared", cleared,
		"left_for_deleter", leftForDeleter,
		"list_duration", listDuration,
		"clear_duration", time.Since(clearStart),
		"total_duration", time.Since(start),
	)
}

// reconcileStaleRecordsOnStartup clears pending-delete records whose tenants
// are not in the informer's synced cache. This closes the gap introduced by
// the label-selected informer, which cannot observe label-removal transitions
// that happened while the pod was offline.
func (tw *TenantWatcher) reconcileStaleRecordsOnStartup(informer cache.SharedIndexInformer) {
	if !cache.WaitForCacheSync(tw.stopCh, informer.HasSynced) {
		tw.log.Warn("informer cache did not sync before stop; skipping startup reconciliation")
		return
	}

	liveNames := make(map[string]struct{})
	for _, obj := range informer.GetIndexer().List() {
		u, ok := obj.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		liveNames[u.GetName()] = struct{}{}
	}
	tw.log.Info("tenant watcher informer synced", "pending_delete_tenants", len(liveNames))

	// An empty list should never happen. If it does something is very wrong, and we don't want to nuke all the
	// pending delete records as a consequence.
	if len(liveNames) == 0 {
		tw.log.Warn("startup reconciliation skipped: informer returned zero tenants")
		return
	}

	tw.reconcileStaleRecords(liveNames)
}

// reconcileStaleRecords iterates the pending-delete KV store and calls
// clearTenantPendingDelete for any record whose tenant is not in liveNames.
// Split out from reconcileStaleRecordsOnStartup for testing without a real
// informer.
func (tw *TenantWatcher) reconcileStaleRecords(liveNames map[string]struct{}) {
	var stale []string
	for name, err := range tw.pendingDeleteStore.Names(tw.ctx) {
		if err != nil {
			tw.log.Error("startup reconciliation: failed to list pending-delete records", "error", err)
			return
		}
		if _, live := liveNames[name]; !live {
			stale = append(stale, name)
		}
	}

	if len(stale) == 0 {
		tw.log.Info("startup reconciliation complete", "stale_records", 0, "live_tenants", len(liveNames))
		return
	}

	tw.log.Info("startup reconciliation clearing stale records", "stale_records", len(stale), "live_tenants", len(liveNames))
	for _, name := range stale {
		tw.clearTenantPendingDelete(name)
	}
}

// Stop stops the tenant watcher and waits for the informer goroutines to exit.
func (tw *TenantWatcher) Stop() {
	close(tw.stopCh)
	if tw.factory != nil {
		tw.factory.Shutdown()
	}
}

func (tw *TenantWatcher) handleTenant(tenant *unstructured.Unstructured) {
	name := tenant.GetName()
	labels := tenant.GetLabels()
	annotations := tenant.GetAnnotations()

	tw.log.Debug("tenant watcher got tenant event", "tenant", name, "labels", labels, "annotations", annotations)

	if labels[labelPendingDelete] == "true" {
		deleteAfter, ok := annotations[annotationPendingDeleteAfter]
		if !ok {
			tw.log.Warn("tenant marked pending-delete but missing delete-after annotation", "tenant", name)
			return
		}
		tw.reconcileTenantPendingDelete(name, deleteAfter)
	} else {
		tw.clearTenantPendingDelete(name)
	}
}

// reconcileTenantPendingDelete ensures a pending-delete record exists for the
// tenant and that all of its resources have been labelled.
func (tw *TenantWatcher) reconcileTenantPendingDelete(name string, deleteAfter string) {
	// Fast path: if the record exists and labelling is complete, nothing to do.
	record, err := tw.pendingDeleteStore.Get(tw.ctx, name)
	if err == nil && record.LabelingComplete {
		return
	}
	if err != nil && !errors.Is(err, kvpkg.ErrNotFound) {
		tw.log.Error("failed to read pending delete record, skipping reconcile to avoid overwriting existing state", "tenant", name, "error", err)
		return
	}

	// Write the intent record BEFORE labelling so that clearTenantPendingDelete
	// can clean up orphaned labels if labelling fails partway through.
	record = PendingDeleteRecord{
		DeleteAfter:      deleteAfter,
		LabelingComplete: false,
		Orphaned:         record.Orphaned,
	}
	if err := tw.pendingDeleteStore.Upsert(tw.ctx, name, record); err != nil {
		tw.log.Error("failed to save pending delete record", "tenant", name, "error", err)
		return
	}

	if err := tw.tenantResourcesEditPendingDeleteLabel(name, true); err != nil {
		tw.log.Error("failed to label tenant resources", "tenant", name, "error", err)
		return
	}

	// Mark labelling as complete.
	record.LabelingComplete = true
	if err := tw.pendingDeleteStore.Upsert(tw.ctx, name, record); err != nil {
		tw.log.Error("failed to mark labeling complete", "tenant", name, "error", err)
	}
	tw.log.Info("reconciled tenant pending delete", "tenant", name, "delete_after", deleteAfter)
}

// tenantResourcesEditPendingDeleteLabel iterates every resource belonging to
// the given tenant and adds or removes the pending-delete label.
func (tw *TenantWatcher) tenantResourcesEditPendingDeleteLabel(tenantName string, addLabel bool) error {
	groupResources, err := tw.dataStore.getGroupResources(tw.ctx)
	if err != nil {
		return fmt.Errorf("getting group resources: %w", err)
	}

	for _, gr := range groupResources {
		listKey := ListRequestKey{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: tenantName,
		}

		for dataKey, err := range tw.dataStore.ListLatestResourceKeys(tw.ctx, listKey) {
			if err != nil {
				return fmt.Errorf("listing resource keys for %s/%s: %w", gr.Group, gr.Resource, err)
			}

			if err := tw.editResourceLabel(dataKey, addLabel); err != nil {
				return fmt.Errorf("editing label on %s: %w", dataKey.String(), err)
			}
		}
	}

	return nil
}

func (tw *TenantWatcher) editResourceLabel(dataKey DataKey, addLabel bool) error {
	var err error
	for attempt := range editLabelMaxAttempts {
		if attempt > 0 {
			jitter := time.Duration(rand.Int64N(int64(tw.retryMaxDelay)))
			select {
			case <-time.After(jitter):
			case <-tw.ctx.Done():
				return tw.ctx.Err()
			}

			// Re-fetch latest DataKey to get a fresh ResourceVersion.
			dataKey, err = tw.dataStore.GetLatestResourceKey(tw.ctx, GetRequestKey{
				Group:     dataKey.Group,
				Resource:  dataKey.Resource,
				Namespace: dataKey.Namespace,
				Name:      dataKey.Name,
			})
			if err != nil {
				return fmt.Errorf("fetching latest resource key for retry: %w", err)
			}
		}

		err = tw.doEditResourceLabel(dataKey, addLabel)
		if err == nil {
			return nil
		}
		if !apierrors.IsConflict(err) {
			return err
		}
	}
	return fmt.Errorf("editing resource label failed after %d attempts: %w", editLabelMaxAttempts, err)
}

func (tw *TenantWatcher) doEditResourceLabel(dataKey DataKey, addLabel bool) error {
	reader, err := tw.dataStore.Get(tw.ctx, dataKey)
	if err != nil {
		return fmt.Errorf("reading resource: %w", err)
	}
	value, err := io.ReadAll(reader)
	_ = reader.Close()
	if err != nil {
		return fmt.Errorf("reading resource bytes: %w", err)
	}

	tmp := &unstructured.Unstructured{}
	if err := tmp.UnmarshalJSON(value); err != nil {
		return fmt.Errorf("unmarshaling resource: %w", err)
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return fmt.Errorf("accessing metadata: %w", err)
	}

	labels := obj.GetLabels()
	if addLabel {
		if labels[labelPendingDelete] == "true" {
			return nil
		}
		if labels == nil {
			labels = make(map[string]string)
		}
		labels[labelPendingDelete] = "true"
	} else {
		if _, ok := labels[labelPendingDelete]; !ok {
			return nil
		}
		delete(labels, labelPendingDelete)
	}
	obj.SetLabels(labels)

	modifiedValue, err := tmp.MarshalJSON()
	if err != nil {
		return fmt.Errorf("marshaling resource: %w", err)
	}

	event := &WriteEvent{
		Type: resourcepb.WatchEvent_MODIFIED,
		Key: &resourcepb.ResourceKey{
			Group:     dataKey.Group,
			Resource:  dataKey.Resource,
			Namespace: dataKey.Namespace,
			Name:      dataKey.Name,
		},
		PreviousRV: dataKey.ResourceVersion,
		Value:      modifiedValue,
		Object:     obj,
	}

	if _, err := tw.writeEvent(tw.ctx, event); err != nil {
		return fmt.Errorf("writing event: %w", err)
	}
	return nil
}

// clearTenantPendingDelete removes the pending-delete record for a tenant from
// the KV store. No-op if the tenant has no record.
func (tw *TenantWatcher) clearTenantPendingDelete(name string) {
	record, err := tw.pendingDeleteStore.Get(tw.ctx, name)
	if errors.Is(err, kvpkg.ErrNotFound) {
		return
	}
	if err != nil {
		tw.log.Warn("failed to get pending delete record for clearing", "tenant", name, "error", err)
		return
	}

	if record.Orphaned {
		tw.log.Warn("tenant has orphaned pending-delete record, skipping clear", "tenant", name)
		return
	}

	// Mark labelling as incomplete before unlabelling. If unlabelling fails
	// partway and the tenant is re-marked as pending-delete before we retry,
	// reconcileTenantPendingDelete will see LabelingComplete=false and re-label.
	if record.LabelingComplete {
		record.LabelingComplete = false
		if err := tw.pendingDeleteStore.Upsert(tw.ctx, name, record); err != nil {
			tw.log.Error("failed to mark labeling incomplete before unlabelling", "tenant", name, "error", err)
			return
		}
	}

	if err := tw.tenantResourcesEditPendingDeleteLabel(name, false); err != nil {
		tw.log.Error("failed to unlabel tenant resources, will not delete pending delete record", "tenant", name, "error", err)
		return
	}

	if err := tw.pendingDeleteStore.Delete(tw.ctx, name); err != nil {
		tw.log.Warn("failed to delete pending delete record", "tenant", name, "error", err)
		return
	}
	tw.log.Info("cleared tenant pending delete", "tenant", name)
}

// TEMPORARY DIAGNOSTIC — remove after investigation.
// Paginates through tenants with the pending-delete label via direct LIST so
// we can compare the server-side filtered count against what the informer
// actually delivers to handleTenant.
func diagnoseTenantListSize(ctx context.Context, dyn dynamic.Interface, logger log.Logger, apiURL string) {
	logger.Info("diag: starting", "api_url", apiURL)
	const pageSize = 500
	start := time.Now()
	var totalCount, totalBytes, pageCount int
	var continueToken string
	unique := make(map[string]struct{})
	duplicateHits := 0
	for {
		page, err := dyn.Resource(tenantGVR).List(ctx, metav1.ListOptions{
			Limit:         pageSize,
			Continue:      continueToken,
			LabelSelector: labelPendingDelete + "=true",
		})
		if err != nil {
			logger.Error("diag: pending list",
				"err", err,
				"pages_so_far", pageCount,
				"count_so_far", totalCount,
				"unique_so_far", len(unique),
				"bytes_so_far", totalBytes,
			)
			return
		}
		pageCount++
		firstName := ""
		lastName := ""
		if len(page.Items) > 0 {
			firstName = page.Items[0].GetName()
			lastName = page.Items[len(page.Items)-1].GetName()
		}
		for _, item := range page.Items {
			name := item.GetName()
			if _, seen := unique[name]; seen {
				duplicateHits++
			}
			unique[name] = struct{}{}
			b, _ := item.MarshalJSON()
			totalBytes += len(b)
		}
		totalCount += len(page.Items)
		// Log every 50 pages (and the first few) so we can see pagination advancing.
		if pageCount <= 3 || pageCount%50 == 0 {
			logger.Info("diag: page sample",
				"page", pageCount,
				"items", len(page.Items),
				"first", firstName,
				"last", lastName,
				"continue_len", len(continueToken),
			)
		}
		continueToken = page.GetContinue()
		if continueToken == "" {
			break
		}
	}
	avg := 0
	if totalCount > 0 {
		avg = totalBytes / totalCount
	}
	logger.Info("diag: pending count",
		"count", totalCount,
		"unique_count", len(unique),
		"duplicate_hits", duplicateHits,
		"total_bytes", totalBytes,
		"avg_bytes", avg,
		"pages", pageCount,
		"elapsed", time.Since(start),
	)
}
