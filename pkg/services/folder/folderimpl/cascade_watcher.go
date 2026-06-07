package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	claims "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const defaultCascadeWatcherPollInterval = 60 * time.Second

// terminatingLabelField is the search return-field carrying the terminating label, so a child
// hit reports whether its own deletion has already begun. It lets the watcher skip re-issuing
// deletes for children already draining, without a second search or lookup.
//
// This relies on the search backend (bleve) echoing back "labels."-prefixed return fields. If a
// backend does not, every child parses as not-terminating and the watcher falls back to
// re-issuing deletes each tick -- still correct (deletes are idempotent), just less efficient.
var terminatingLabelField = resource.SEARCH_FIELD_LABELS + "." + folders.TerminatingLabel

// folderSearcher is the subset of client.K8sHandler used to search folders via unified search.
type folderSearcher interface {
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

// folderMutator deletes Folder CRs and removes the cascade finalizer once children are gone.
type folderMutator interface {
	Delete(ctx context.Context, namespace, name string, gracePeriodSeconds *int64) error
	RemoveCascadeFinalizer(ctx context.Context, namespace, name string) error
}

// folderGetter fetches a single folder CR. Split from folderMutator so the poller can be tested
// without a real (dynamic) client.
type folderGetter interface {
	Get(ctx context.Context, namespace, name string) (*foldersv1.Folder, error)
}

// orgLister enumerates organizations; the poller searches each org once per tick.
type orgLister interface {
	Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// CascadeWatcher drives cascade deletion of folders that are terminating with the cascade-delete
// finalizer: it deletes direct child folders, and once a folder has no remaining children it
// removes the cascade finalizer so the folder can be garbage-collected.
//
// Discovery is a periodic poll, not a List+Watch. Every poll interval the watcher enumerates orgs
// and, for each, runs one unified-search query for folders carrying the terminating label, then
// reconciles each. This avoids holding a cluster-wide folder watch; the cost is one search per org
// per tick (cheap when nothing is terminating, thanks to the label filter) and cascade latency
// bounded by the poll interval per tree level rather than being event-driven.
type CascadeWatcher struct {
	restConfig      apiserver.RestConfigProvider
	orgs            orgLister
	namespaceMapper request.NamespaceMapper
	folderSearch    folderSearcher
	folderMutator   folderMutator
	getter          folderGetter
	flagEnabled     func(ctx context.Context) bool
	log             *slog.Logger
	pollInterval    time.Duration
}

func ProvideCascadeWatcher(
	cfg *setting.Cfg,
	restConfig apiserver.RestConfigProvider,
	resourceClient resource.ResourceClient,
	userService user.Service,
	orgService org.Service,
) *CascadeWatcher {
	folderSearch := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		foldersv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)

	pollInterval := cfg.SectionWithEnvOverrides("folder_cascade_delete").
		Key("poll_interval").MustDuration(defaultCascadeWatcherPollInterval)

	return &CascadeWatcher{
		restConfig:      restConfig,
		orgs:            orgService,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		folderSearch:    folderSearch,
		flagEnabled:     cascadeDeleteFlagEnabled,
		log:             slog.Default().With("logger", "folder-cascade-watcher"),
		pollInterval:    pollInterval,
	}
}

// cascadeDeleteFlagEnabled reports whether the cascade-delete feature is on. The watcher reads
// it once, at startup, in Run.
//
// This is a second, independent boot-time read of the same flag that the folders API builder
// captures in storageForVersion (FolderAPIBuilder.cascadeDeleteEnabled), which gates both the
// finalizer storage wrapper and admission finalizer stamping. The two must agree: if admission
// stamps the cascade finalizer but this watcher is not running, deleted folders would stay stuck
// terminating with nothing to remove their finalizer.
//
// When the folders API server runs in the same process as this watcher, they agree because both
// read the same flag at process startup; the flag is treated as static for the process lifetime,
// so changing it (including per-tenant in a dynamic provider) requires a restart. But the API
// server can also be deployed as a separate process from the Grafana process that runs this
// watcher. In that split deployment the two reads happen in different processes, so agreement
// depends on both being configured with the same flag value and rolled out together; a mismatch
// (flag on for the API server, off where the watcher runs) reintroduces the stuck-terminating risk.
func cascadeDeleteFlagEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}

// Run implements registry.BackgroundService.
func (w *CascadeWatcher) Run(ctx context.Context) error {
	if w.flagEnabled == nil || !w.flagEnabled(ctx) {
		w.log.Debug("folder cascade watcher disabled", "flag", featuremgmt.FlagKubernetesFolderCascadeDelete)
		return nil
	}

	restCfg, err := w.restConfig.GetRestConfig(ctx)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		w.log.Debug("folder cascade watcher not started", "reason", err)
		return nil
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("create folder dynamic client: %w", err)
	}

	mut := &dynamicFolderMutator{client: dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource())}
	w.folderMutator = mut
	w.getter = mut

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	w.log.Info("folder cascade watcher started", "pollInterval", w.pollInterval)
	w.pollOnce(ctx)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			w.pollOnce(ctx)
		}
	}
}

// pollOnce reconciles terminating folders across all orgs once.
func (w *CascadeWatcher) pollOnce(ctx context.Context) {
	orgs, err := w.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		w.log.Warn("folder cascade poll: list orgs failed", "error", err)
		return
	}
	for _, o := range orgs {
		select {
		case <-ctx.Done():
			return
		default:
		}
		w.reconcileOrg(ctx, o.ID)
	}
}

// reconcileOrg searches one org for terminating folders and reconciles each.
func (w *CascadeWatcher) reconcileOrg(ctx context.Context, orgID int64) {
	svcCtx := identity.WithServiceIdentityContext(ctx, orgID)

	names, err := searchTerminatingFolders(svcCtx, w.folderSearch, orgID)
	if err != nil {
		w.log.Warn("folder cascade poll: search terminating folders failed", "orgID", orgID, "error", err)
		return
	}
	if len(names) == 0 {
		return
	}

	ns := w.namespaceMapper(orgID)
	for _, name := range names {
		f, err := w.getter.Get(svcCtx, ns, name)
		if err != nil {
			if !apierrors.IsNotFound(err) {
				w.log.Warn("folder cascade poll: get folder failed", "namespace", ns, "name", name, "error", err)
			}
			continue
		}
		if err := w.reconcileFolder(svcCtx, f); err != nil {
			// A failed reconcile is retried on the next tick.
			w.log.Warn("folder cascade reconcile failed", "namespace", ns, "name", name, "error", err)
		}
	}
}

// searchTerminatingFolders returns the UIDs of folders in orgID that carry the terminating label,
// via unified search with a server-side label filter.
func searchTerminatingFolders(ctx context.Context, searcher folderSearcher, orgID int64) ([]string, error) {
	if searcher == nil {
		return nil, nil
	}

	labels := []*resourcepb.Requirement{{
		Key:      folders.TerminatingLabel,
		Operator: string(selection.In),
		Values:   []string{folders.TerminatingLabelValue},
	}}

	var names []string
	for offset := int64(0); ; {
		resp, err := searcher.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Labels: labels},
			Limit:   searchPageSize,
			Offset:  offset,
		})
		if err != nil {
			return nil, err
		}

		parsed, err := dashboardsearch.ParseResults(resp, 0)
		if err != nil {
			return nil, err
		}

		for _, h := range parsed.Hits {
			names = append(names, h.Name)
		}

		n := int64(len(parsed.Hits))
		if n < searchPageSize {
			return names, nil
		}
		offset += n
	}
}

func (w *CascadeWatcher) reconcileFolder(ctx context.Context, f *foldersv1.Folder) error {
	if !isTerminatingForCascade(f) {
		return nil
	}

	orgID, err := orgIDFromNamespace(f.Namespace)
	if err != nil {
		// A malformed namespace will not fix itself, so do not retry.
		w.log.Warn("failed to resolve org for terminating folder", "namespace", f.Namespace, "name", f.Name, "error", err)
		return nil
	}

	svcCtx := identity.WithServiceIdentityContext(ctx, orgID)
	children, err := listDirectChildFolders(svcCtx, w.folderSearch, orgID, f.Name)
	if err != nil {
		return fmt.Errorf("list child folders: %w", err)
	}

	// The parent keeps its finalizer until the whole subtree is gone: removal is gated on the
	// total child count, including children still terminating, not just the ones deleted below.
	if len(children) == 0 {
		if w.folderMutator == nil {
			return nil
		}
		if err := w.folderMutator.RemoveCascadeFinalizer(svcCtx, f.Namespace, f.Name); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("remove cascade finalizer: %w", err)
		}
		w.log.Info("removed cascade finalizer", "namespace", f.Namespace, "name", f.Name, "orgID", orgID)
		return nil
	}

	if w.folderMutator == nil {
		return nil
	}

	// Only delete children that are not already terminating; the rest are draining via their
	// own finalizers, so re-issuing a delete each tick would be redundant.
	gracePeriod := f.DeletionGracePeriodSeconds
	deleted := 0
	var deleteErr error
	for _, child := range children {
		if child.terminating {
			continue
		}
		if err := w.folderMutator.Delete(svcCtx, f.Namespace, child.name, gracePeriod); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("failed to delete child folder", "namespace", f.Namespace, "parent", f.Name, "child", child.name, "error", err)
			deleteErr = err
			continue
		}
		deleted++
	}

	if deleted > 0 {
		w.log.Info("cascading delete to child folders",
			"namespace", f.Namespace,
			"name", f.Name,
			"orgID", orgID,
			"childFoldersDeleted", deleted,
			"childFolderCount", len(children),
		)
	}

	if deleteErr != nil {
		return fmt.Errorf("delete child folder: %w", deleteErr)
	}
	return nil
}

// childFolder is a direct child folder returned by search, flagged with whether its own
// deletion has already begun (the terminating label is present).
type childFolder struct {
	name        string
	terminating bool
}

// listDirectChildFolders returns the direct child folders of parentUID via unified search
// (same parent index as the folder store GetDescendants / searchChildren), each flagged with
// whether it is already terminating. The terminating label is requested as a return field so a
// single search both enumerates the children (for the parent's finalizer-removal gate) and
// identifies which still need a delete issued.
func listDirectChildFolders(ctx context.Context, searcher folderSearcher, orgID int64, parentUID string) ([]childFolder, error) {
	if searcher == nil {
		return nil, nil
	}
	if parentUID == folder.GeneralFolderUID {
		parentUID = ""
	}

	fields := []*resourcepb.Requirement{{
		Key:      resource.SEARCH_FIELD_FOLDER,
		Operator: string(selection.In),
		Values:   []string{parentUID},
	}}

	var children []childFolder
	for offset := int64(0); ; {
		resp, err := searcher.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Fields: fields},
			Fields:  []string{terminatingLabelField},
			Limit:   searchPageSize,
			Offset:  offset,
		})
		if err != nil {
			return nil, err
		}

		parsed, err := dashboardsearch.ParseResults(resp, 0)
		if err != nil {
			return nil, err
		}

		for _, h := range parsed.Hits {
			children = append(children, childFolder{
				name:        h.Name,
				terminating: h.Field != nil && h.Field.GetNestedString(terminatingLabelField) == folders.TerminatingLabelValue,
			})
		}

		n := int64(len(parsed.Hits))
		if n < searchPageSize {
			return children, nil
		}
		offset += n
	}
}

// dynamicFolderMutator implements folderMutator and folderGetter on top of the folders dynamic client.
type dynamicFolderMutator struct {
	client dynamic.NamespaceableResourceInterface
}

func (d *dynamicFolderMutator) Get(ctx context.Context, namespace, name string) (*foldersv1.Folder, error) {
	obj, err := d.client.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	f, ok := asFolderCR(obj)
	if !ok {
		return nil, fmt.Errorf("object %s/%s is not a folder", namespace, name)
	}
	return f, nil
}

func (d *dynamicFolderMutator) Delete(ctx context.Context, namespace, name string, gracePeriodSeconds *int64) error {
	return d.client.Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{GracePeriodSeconds: gracePeriodSeconds})
}

func (d *dynamicFolderMutator) RemoveCascadeFinalizer(ctx context.Context, namespace, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := d.client.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		finalizers := obj.GetFinalizers()
		remaining := make([]string, 0, len(finalizers))
		for _, fin := range finalizers {
			if fin != folders.CascadeDeleteFinalizer {
				remaining = append(remaining, fin)
			}
		}
		if len(remaining) == len(finalizers) {
			return nil
		}

		obj.SetFinalizers(remaining)
		_, err = d.client.Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
		return err
	})
}

func orgIDFromNamespace(ns string) (int64, error) {
	info, err := claims.ParseNamespace(ns)
	if err != nil {
		return 0, err
	}
	if info.OrgID < 1 {
		return 0, fmt.Errorf("invalid org id in namespace %q", ns)
	}
	return info.OrgID, nil
}

func isTerminatingForCascade(f *foldersv1.Folder) bool {
	if f.DeletionTimestamp == nil || f.DeletionTimestamp.IsZero() {
		return false
	}
	return folders.HasCascadeFinalizer(f)
}

func asFolderCR(obj interface{}) (*foldersv1.Folder, bool) {
	switch o := obj.(type) {
	case *foldersv1.Folder:
		return o, true
	case *unstructured.Unstructured:
		f := &foldersv1.Folder{}
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(o.Object, f); err != nil {
			return nil, false
		}
		return f, true
	default:
		return nil, false
	}
}

// IsDisabled implements registry.CanBeDisabled.
func (w *CascadeWatcher) IsDisabled() bool {
	return w.restConfig == nil
}

var (
	_ registry.BackgroundService = (*CascadeWatcher)(nil)
	_ registry.CanBeDisabled     = (*CascadeWatcher)(nil)
)
