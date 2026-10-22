package resource

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/services"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// v1alpha2 is the only version with SearchFields.
//
// Exported because a server that reads AppManifests with its own client, rather
// than through this watcher, still has to list the same resource.
var AppManifestGVR = schema.GroupVersionResource{
	Group:    "apps.grafana.app",
	Version:  "v1alpha2",
	Resource: "appmanifests",
}

// ManifestDiscoveryGVR is the router's read-only view of the AppManifests of
// the groups it serves. Its items are apps.grafana.app/v1alpha2 AppManifests,
// named by group, so they convert the same way as AppManifestGVR objects.
var ManifestDiscoveryGVR = schema.GroupVersionResource{
	Group:    "discovery",
	Version:  appmanifestv1alpha2.APIVersion, // the router versions the group by the AppManifest kind
	Resource: "manifests",
}

const (
	manifestSourceDiscovery    = "discovery"
	manifestSourceAppManifests = "appmanifests"
)

// Until a poll lists a set, polls retry with backoff from manifestRetryMin up
// to the poll interval, so a server that was briefly unavailable at startup
// doesn't leave search without live manifests for a whole interval.
const manifestRetryMin = 5 * time.Second

// manifestPollTimeout bounds each source's list so a hung request can't wedge
// the watcher: without it a stalled initial poll would block reaching Running
// and a stalled later poll would block all retries. It is per source so a hung
// source still leaves the next one its full time.
const manifestPollTimeout = 1 * time.Minute

// ManifestWatcherConfig holds the connection settings for the servers that
// publish AppManifests. When both are set, the router's discovery endpoint is
// preferred and the app-platform apiserver is the fallback, while discovery is
// still being rolled out.
type ManifestWatcherConfig struct {
	// APIServerURL is the URL of the app-platform apiserver serving AppManifests.
	APIServerURL string
	// DiscoveryURL is the URL of the router serving /apis/discovery/v1alpha2/manifests.
	DiscoveryURL string
	// DiscoveryAudience is the token audience the router accepts.
	DiscoveryAudience string
	// Token is the system token used to sign access tokens.
	Token string
	// TokenExchangeURL is the URL used to exchange the system token for an access token.
	TokenExchangeURL string
	// CAFile is the path to a PEM-encoded CA bundle for verifying the apiserver.
	CAFile string
	// AllowInsecure skips TLS verification (local dev only).
	AllowInsecure bool
	// PollInterval is the delay between poll cycles. Defaults to 1 hour if zero.
	PollInterval time.Duration
	Log          log.Logger
}

// NewManifestWatcherConfig builds a ManifestWatcherConfig from Grafana settings
// and returns nil when neither the apiserver nor the discovery URL is set, or
// the token or token exchange URL is unset, so the watcher stays off unless
// explicitly configured.
func NewManifestWatcherConfig(cfg *setting.Cfg) *ManifestWatcherConfig {
	logger := log.New("search-manifest-watcher")
	if cfg == nil {
		return nil
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	allowInsecure := cfg.ManifestWatcherAllowInsecureTLS
	if allowInsecure && cfg.Env != setting.Dev {
		logger.Error("manifest_watcher_allow_insecure_tls is set but app_mode is not 'development'; enforcing TLS verification", "app_mode", cfg.Env)
		allowInsecure = false
	}

	wc := &ManifestWatcherConfig{
		APIServerURL:      strings.TrimSpace(cfg.ManifestApiServerAddress),
		DiscoveryURL:      strings.TrimSpace(cfg.ManifestDiscoveryAddress),
		DiscoveryAudience: strings.TrimSpace(cfg.ManifestDiscoveryAudience),
		Token:             strings.TrimSpace(grpcSection.Key("token").MustString("")),
		TokenExchangeURL:  strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString("")),
		CAFile:            strings.TrimSpace(cfg.ManifestWatcherCAFile),
		AllowInsecure:     allowInsecure,
		PollInterval:      cfg.ManifestWatcherPollInterval,
		Log:               logger,
	}

	if wc.DiscoveryURL != "" && wc.DiscoveryAudience == "" {
		logger.Error("manifest_discovery_url is set without manifest_discovery_audience; ignoring the discovery endpoint")
		wc.DiscoveryURL = ""
	}
	if (wc.APIServerURL == "" && wc.DiscoveryURL == "") || wc.Token == "" || wc.TokenExchangeURL == "" {
		logger.Warn("manifest watcher not configured - ensure a manifest api server or discovery address, token, and token exchange url are set")
		return nil
	}
	return wc
}

// manifestSource is one place the watcher can list AppManifests from.
type manifestSource struct {
	name string // metric label value
	list func(ctx context.Context) ([]listedManifest, error)
}

// listedManifest is one listed object, keyed by its object name. err is set
// when the object could not be converted.
type listedManifest struct {
	name     string
	manifest *app.ManifestData
	err      error
}

// dynamicManifestSource pages through the AppManifests a Kubernetes API serves
// as gvr.
func dynamicManifestSource(name string, client dynamic.Interface, gvr schema.GroupVersionResource) manifestSource {
	return manifestSource{name: name, list: func(ctx context.Context) ([]listedManifest, error) {
		var listed []listedManifest
		var continueToken string
		for {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			page, err := client.Resource(gvr).List(ctx, metav1.ListOptions{
				Limit:    pollPageSize,
				Continue: continueToken,
			})
			if err != nil {
				return nil, fmt.Errorf("listing %s: %w", gvr.Resource, err)
			}
			for i := range page.Items {
				m, err := ManifestFromUnstructured(&page.Items[i])
				listed = append(listed, listedManifest{name: page.Items[i].GetName(), manifest: m, err: err})
			}
			continueToken = page.GetContinue()
			if continueToken == "" {
				return listed, nil
			}
		}
	}}
}

// discoveryManifestSource lists the manifests the router publishes, read
// in-process.
func discoveryManifestSource(discovery ManifestDiscovery) manifestSource {
	return manifestSource{name: manifestSourceDiscovery, list: func(ctx context.Context) ([]listedManifest, error) {
		list, err := discovery.ListManifests(ctx)
		if err != nil {
			return nil, fmt.Errorf("listing discovery manifests: %w", err)
		}
		listed := make([]listedManifest, 0, len(list.Items))
		for i := range list.Items {
			m, err := manifestFromSpec(list.Items[i].Spec)
			listed = append(listed, listedManifest{name: list.Items[i].Name, manifest: m, err: err})
		}
		return listed, nil
	}}
}

// ManifestWatcher polls for AppManifests and keeps a current snapshot. It only
// produces the live manifest set; it does not wire it into search.
type ManifestWatcher struct {
	services.Service

	log log.Logger
	// sources are tried in order each poll; the first that lists a non-empty
	// set wins.
	sources      []manifestSource
	pollInterval time.Duration
	// sourceTimeout bounds each source's list; manifestPollTimeout outside tests.
	sourceTimeout time.Duration
	onChange      func([]*app.ManifestData)
	metrics       *manifestWatcherMetrics

	// Names are only comparable within a source. Track the source even when a
	// switch leaves the content hash unchanged, so conversion failures can
	// recover the correct previous manifest.
	mu       sync.RWMutex
	byName   map[string]*app.ManifestData
	source   string
	lastHash string
}

// manifestWatcherMetrics are the watcher's Prometheus metrics. Built with a nil
// registerer in tests, which promauto treats as a no-op.
type manifestWatcherMetrics struct {
	polls       *prometheus.CounterVec
	sourcePolls *prometheus.CounterVec
	reloads     prometheus.Counter
	manifests   prometheus.Gauge
	lastSuccess prometheus.Gauge
}

func newManifestWatcherMetrics(reg prometheus.Registerer) *manifestWatcherMetrics {
	return &manifestWatcherMetrics{
		polls: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_search_manifest_watcher_polls_total",
			Help: "Manifest watcher poll cycles by result (success, empty, error).",
		}, []string{"result"}),
		sourcePolls: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_search_manifest_watcher_source_polls_total",
			Help: "Manifest watcher list attempts by source (discovery, appmanifests) and result (success, empty, error).",
		}, []string{"source", "result"}),
		reloads: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "grafana_search_manifest_watcher_reloads_total",
			Help: "Times the manifest watcher published a changed manifest set.",
		}),
		manifests: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_search_manifest_watcher_manifests",
			Help: "Number of manifests in the current watcher snapshot.",
		}),
		lastSuccess: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_search_manifest_watcher_last_success_timestamp_seconds",
			Help: "Unix time of the last successful manifest watcher poll (list succeeded).",
		}),
	}
}

// newManifestTokenExchanger builds the token exchange client shared by every
// manifest source.
func newManifestTokenExchanger(cfg ManifestWatcherConfig) (authnlib.TokenExchanger, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MinVersion: tls.VersionTLS13}, //nolint:gosec
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
	return tc, nil
}

// newManifestRESTConfig builds a rest.Config for one manifest source.
func newManifestRESTConfig(cfg ManifestWatcherConfig, host string, wrap transport.WrapperFunc) *rest.Config {
	return &rest.Config{
		APIPath:       "/apis",
		Host:          host,
		WrapTransport: wrap,
		TLSClientConfig: rest.TLSClientConfig{
			CAFile:   cfg.CAFile,
			Insecure: cfg.AllowInsecure && cfg.CAFile == "",
		},
	}
}

// manifestAuthWrapper builds the transport wrapper used to reach the app-platform
// apiserver. That server authenticates a standard bearer token from the
// Authorization header, so the exchanged token must go there rather than in the
// authlib X-Access-Token header. The token audience is the API group.
func manifestAuthWrapper(exchanger authnlib.TokenExchanger) transport.WrapperFunc {
	return clientauth.NewStaticTokenExchangeAuthorizationTransportWrapper(exchanger, AppManifestGVR.Group, clientauth.WildcardNamespace)
}

// discoveryAuthWrapper builds the transport wrapper used to reach the router,
// which authenticates the authlib X-Access-Token header against its own
// configured audiences.
func discoveryAuthWrapper(exchanger authnlib.TokenExchanger, audience string) transport.WrapperFunc {
	return clientauth.NewStaticTokenExchangeTransportWrapper(exchanger, audience, clientauth.WildcardNamespace)
}

// NewManifestWatcher polls once before entering Running, then retries failed or
// empty polls in the background. onChange may be nil.
func NewManifestWatcher(cfg ManifestWatcherConfig, reg prometheus.Registerer, onChange func([]*app.ManifestData)) (*ManifestWatcher, error) {
	tc, err := newManifestTokenExchanger(cfg)
	if err != nil {
		return nil, err
	}

	// Discovery first: the apiserver is the fallback while discovery rolls out.
	var sources []manifestSource
	for _, s := range []struct {
		name string
		host string
		wrap transport.WrapperFunc
		gvr  schema.GroupVersionResource
	}{
		{manifestSourceDiscovery, cfg.DiscoveryURL, discoveryAuthWrapper(tc, cfg.DiscoveryAudience), ManifestDiscoveryGVR},
		{manifestSourceAppManifests, cfg.APIServerURL, manifestAuthWrapper(tc), AppManifestGVR},
	} {
		if s.host == "" {
			continue
		}
		client, err := dynamic.NewForConfig(newManifestRESTConfig(cfg, s.host, s.wrap))
		if err != nil {
			return nil, fmt.Errorf("creating %s dynamic client: %w", s.name, err)
		}
		sources = append(sources, dynamicManifestSource(s.name, client, s.gvr))
	}
	if len(sources) == 0 {
		return nil, fmt.Errorf("manifest watcher needs an apiserver or discovery URL")
	}

	interval := cfg.PollInterval
	if interval <= 0 {
		interval = defaultPollInterval
	}

	return newManifestWatcher(sources, interval, onChange, cfg.Log, reg), nil
}

func newManifestWatcher(sources []manifestSource, pollInterval time.Duration, onChange func([]*app.ManifestData), logger log.Logger, reg prometheus.Registerer) *ManifestWatcher {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	w := &ManifestWatcher{
		log:           logger,
		sources:       sources,
		pollInterval:  pollInterval,
		sourceTimeout: manifestPollTimeout,
		onChange:      onChange,
		metrics:       newManifestWatcherMetrics(reg),
	}
	w.Service = services.NewBasicService(w.starting, w.running, nil)
	return w
}

// Manifests returns the current snapshot as an ordered slice.
func (w *ManifestWatcher) Manifests() []*app.ManifestData {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return sortedManifests(w.byName)
}

// An unavailable source must not prevent storage from starting.
func (w *ManifestWatcher) starting(ctx context.Context) error {
	w.runPollCycle(ctx)
	return nil
}

func (w *ManifestWatcher) running(ctx context.Context) error {
	retry := backoff.New(ctx, backoff.Config{MinBackoff: min(manifestRetryMin, w.pollInterval), MaxBackoff: w.pollInterval})
	for {
		delay := w.pollInterval
		if !w.hasSnapshot() {
			delay = retry.NextDelay()
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil
		case <-timer.C:
			w.runPollCycle(ctx)
		}
	}
}

func (w *ManifestWatcher) hasSnapshot() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.byName) > 0
}

// runPollCycle publishes the manifest set only if it changed. A failed list or
// an empty result keeps the previous snapshot: an unreachable or half-ready
// apiserver must never blank the live set, which would drop search fields and
// force a needless reindex.
func (w *ManifestWatcher) runPollCycle(ctx context.Context) {
	w.mu.RLock()
	prev := w.byName
	previousSource := w.source
	w.mu.RUnlock()

	result, source, err := w.listFirst(ctx, prev, previousSource)
	if err != nil {
		w.metrics.polls.WithLabelValues("error").Inc()
		w.log.Error("manifest watcher poll cycle: list failed, keeping previous set", "error", err)
		return
	}
	w.metrics.lastSuccess.SetToCurrentTime()
	if len(result) == 0 {
		w.metrics.polls.WithLabelValues("empty").Inc()
		w.log.Warn("manifest watcher poll cycle: zero manifests, keeping previous set")
		return
	}
	w.metrics.polls.WithLabelValues("success").Inc()

	manifests := sortedManifests(result)
	hash, err := hashManifests(manifests)
	if err != nil {
		// Can't dedupe without a hash, so publish rather than risk hiding a change.
		w.log.Warn("manifest watcher: hashing failed, publishing anyway", "error", err)
	}

	// Refresh the index on every successful poll, even when the content is
	// unchanged, so a rename (same spec, new object name) doesn't leave the
	// keep-previous lookup pointing at stale keys. Publishing stays gated on the
	// content hash so a pure rename doesn't trigger a needless reindex.
	w.mu.Lock()
	w.byName = result
	w.source = source
	changed := err != nil || hash != w.lastHash
	if changed {
		w.lastHash = hash
	}
	w.mu.Unlock()

	w.metrics.manifests.Set(float64(len(result)))

	if !changed {
		return
	}
	w.metrics.reloads.Inc()
	w.log.Info("manifest watcher published new manifest set", "manifests", len(manifests))
	if w.onChange != nil {
		w.onChange(manifests)
	}
}

// listFirst returns the set from the first source that lists a non-empty one.
// A later source is only asked when an earlier one fails or is empty, so while
// the discovery endpoint is rolling out the apiserver covers stacks without it.
// It returns an error only when every source failed.
func (w *ManifestWatcher) listFirst(ctx context.Context, prev map[string]*app.ManifestData, previousSource string) (map[string]*app.ManifestData, string, error) {
	var errs []error
	listed := false
	for _, src := range w.sources {
		srcCtx, cancel := context.WithTimeout(ctx, w.sourceTimeout)
		result, err := w.list(srcCtx, src, prev, previousSource)
		cancel()
		switch {
		case err != nil:
			w.metrics.sourcePolls.WithLabelValues(src.name, "error").Inc()
			w.log.Warn("manifest watcher: source list failed", "source", src.name, "error", err)
			errs = append(errs, fmt.Errorf("%s: %w", src.name, err))
		case len(result) == 0:
			w.metrics.sourcePolls.WithLabelValues(src.name, "empty").Inc()
			w.log.Warn("manifest watcher: source listed zero manifests", "source", src.name)
			listed = true
		default:
			w.metrics.sourcePolls.WithLabelValues(src.name, "success").Inc()
			w.log.Debug("manifest watcher: listed manifests", "source", src.name, "manifests", len(result))
			return result, src.name, nil
		}
	}
	if listed {
		return nil, "", nil
	}
	return nil, "", errors.Join(errs...)
}

// A failed conversion can reuse the previous manifest only within the same
// source. Switching sources requires a fully converted list because object
// names may differ or refer to different groups.
func (w *ManifestWatcher) list(ctx context.Context, src manifestSource, prev map[string]*app.ManifestData, previousSource string) (map[string]*app.ManifestData, error) {
	listed, err := src.list(ctx)
	if err != nil {
		return nil, err
	}
	result := make(map[string]*app.ManifestData, len(listed))
	for _, item := range listed {
		if item.err != nil {
			// Object names are source-specific. An incomplete conversion from a
			// new source must not replace the snapshot or reuse unrelated names.
			if previousSource != "" && previousSource != src.name {
				return nil, fmt.Errorf("converting manifest %q while switching sources: %w", item.name, item.err)
			}
			if p, ok := prev[item.name]; ok {
				w.log.Warn("manifest watcher: keeping previous manifest, this poll failed to convert it",
					"name", item.name, "error", item.err)
				result[item.name] = p
				continue
			}
			w.log.Warn("manifest watcher: skipping unknown manifest that failed to convert",
				"name", item.name, "error", item.err)
			continue
		}
		result[item.name] = searchManifest(item.manifest)
	}
	return result, nil
}

// searchManifest drops what the discovery endpoint leaves out, so both sources
// publish the same data and switching between them does not force a reindex.
// Search reads neither field.
func searchManifest(m *app.ManifestData) *app.ManifestData {
	out := *m
	out.Operator = nil
	out.ExtraPermissions = nil
	return &out
}

// sortedManifests returns the map values ordered by group, then by object name.
// Ordering by group first gives the same order whichever source listed them
// (discovery names objects by group; the apiserver does not). The name is
// unique, so the published snapshot and its hash stay deterministic even when
// two objects share a group.
func sortedManifests(byName map[string]*app.ManifestData) []*app.ManifestData {
	names := make([]string, 0, len(byName))
	for name := range byName {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool {
		gi, gj := byName[names[i]].Group, byName[names[j]].Group
		if gi != gj {
			return gi < gj
		}
		return names[i] < names[j]
	})
	out := make([]*app.ManifestData, 0, len(byName))
	for _, name := range names {
		out = append(out, byName[name])
	}
	return out
}

// ManifestFromUnstructured converts an AppManifest apiserver object (v1alpha2)
// to app.ManifestData.
//
// Exported so a server that fetches AppManifests with its own client gets the
// same conversion the watcher uses, rather than a second one that could disagree
// about what a manifest means.
func ManifestFromUnstructured(item *unstructured.Unstructured) (*app.ManifestData, error) {
	specRaw, ok := item.Object["spec"]
	if !ok {
		return nil, fmt.Errorf("appmanifest %q has no spec", item.GetName())
	}
	specJSON, err := json.Marshal(specRaw)
	if err != nil {
		return nil, fmt.Errorf("marshaling spec: %w", err)
	}
	var spec appmanifestv1alpha2.AppManifestSpec
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		return nil, fmt.Errorf("unmarshaling spec: %w", err)
	}
	return manifestFromSpec(spec)
}

func manifestFromSpec(spec appmanifestv1alpha2.AppManifestSpec) (*app.ManifestData, error) {
	data, err := spec.ToManifestData()
	if err != nil {
		return nil, fmt.Errorf("converting spec to manifest data: %w", err)
	}
	return &data, nil
}

// hashManifests returns a stable hash of the manifest set, used to skip
// publishing when a poll returns no real change. The input is already ordered by
// sortedManifests, so the hash is deterministic.
func hashManifests(manifests []*app.ManifestData) (string, error) {
	datas := make([]app.ManifestData, 0, len(manifests))
	for _, m := range manifests {
		if m != nil {
			datas = append(datas, *m)
		}
	}
	b, err := json.Marshal(datas)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum), nil
}
