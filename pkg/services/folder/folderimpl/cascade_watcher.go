package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/serverlock"
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

const (
	defaultCascadeWatcherPollInterval = 6 * time.Second
	// cascadeLockName is the serverlock action name guarding the sweep, so only one Grafana
	// instance runs it per interval in an HA deployment.
	cascadeLockName = "folder-cascade-delete"
)

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

// orgLister enumerates organizations; the poller searches each org once per tick.
type orgLister interface {
	Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// CascadeWatcher drives terminating folders to completion. The folders API server marks a deleted
// folder terminating and best-effort marks its subtree asynchronously; this watcher is the source
// of truth: every poll interval it enumerates orgs and, per org, searches for folders carrying the
// terminating label. For each one it marks any not-yet-terminating direct children terminating (so
// the mark always reaches the leaves even if the API server's async pass didn't finish), and once
// a folder has no children left it removes the finalizer so the folder can be garbage-collected --
// bottom-up, so a parent never outlives its subtree.
//
// Discovery is a periodic poll, not a List+Watch: one search per org per tick, cheap when nothing
// is terminating thanks to the label filter. The sweep is guarded by serverlock so only one
// Grafana instance runs it per interval in an HA deployment.
type CascadeWatcher struct {
	restConfig      apiserver.RestConfigProvider
	orgs            orgLister
	namespaceMapper request.NamespaceMapper
	folderSearch    folderSearcher
	folderMutator   folderMutator
	serverLock      *serverlock.ServerLockService
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
	serverLock *serverlock.ServerLockService,
) *CascadeWatcher {
	folderSearch := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		foldersv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)

	pollInterval := cfg.SectionWithEnvOverrides("unified_storage").
		Key("folder_cascade_delete_poll_interval").MustDuration(defaultCascadeWatcherPollInterval)

	return &CascadeWatcher{
		restConfig:      restConfig,
		orgs:            orgService,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		folderSearch:    folderSearch,
		serverLock:      serverLock,
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

	w.folderMutator = &dynamicFolderMutator{client: dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource())}

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	w.log.Info("folder cascade watcher started", "pollInterval", w.pollInterval)
	w.sweep(ctx)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			w.sweep(ctx)
		}
	}
}

// sweep runs one poll, guarded by serverlock so only one Grafana instance does it per interval.
func (w *CascadeWatcher) sweep(ctx context.Context) {
	if w.serverLock == nil {
		w.pollOnce(ctx)
		return
	}
	if err := w.serverLock.LockAndExecute(ctx, cascadeLockName, w.pollInterval, w.pollOnce); err != nil {
		w.log.Warn("folder cascade poll: serverlock failed", "error", err)
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

// reconcileOrg searches one org for terminating folders and finalizes each.
func (w *CascadeWatcher) reconcileOrg(ctx context.Context, orgID int64) {
	svcCtx := identity.WithServiceIdentityContext(ctx, orgID)

	names, err := searchTerminatingFolders(svcCtx, w.folderSearch, orgID)
	if err != nil {
		w.log.Warn("folder cascade poll: search terminating folders failed", "orgID", orgID, "error", err)
		return
	}

	ns := w.namespaceMapper(orgID)
	for _, name := range names {
		w.finalizeTerminatingFolder(svcCtx, orgID, ns, name)
	}
}

// finalizeTerminatingFolder advances one terminating folder. If it still has children, the
// not-yet-terminating ones are marked terminating and the folder keeps its finalizer. Only once it
// has no children left is the finalizer removed, so a folder is never garbage-collected before its
// subtree -- the tree drains bottom-up over successive ticks.
func (w *CascadeWatcher) finalizeTerminatingFolder(ctx context.Context, orgID int64, namespace, name string) {
	if w.folderMutator == nil {
		return
	}

	children, err := listDirectChildFolders(ctx, w.folderSearch, orgID, name)
	if err != nil {
		w.log.Warn("folder cascade poll: list child folders failed", "namespace", namespace, "name", name, "error", err)
		return
	}

	if len(children) == 0 {
		if err := w.folderMutator.RemoveCascadeFinalizer(ctx, namespace, name); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("folder cascade poll: remove finalizer failed", "namespace", namespace, "name", name, "error", err)
		}
		return
	}

	// Still has children: mark the ones not already terminating so the mark reaches the leaves,
	// and keep this folder's finalizer until its subtree is gone.
	zero := int64(0)
	for _, child := range children {
		if child.terminating {
			continue
		}
		if err := w.folderMutator.Delete(ctx, namespace, child.name, &zero); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("folder cascade poll: mark child terminating failed", "namespace", namespace, "parent", name, "child", child.name, "error", err)
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

// dynamicFolderMutator implements folderMutator on top of the folders dynamic client.
type dynamicFolderMutator struct {
	client dynamic.NamespaceableResourceInterface
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

// IsDisabled implements registry.CanBeDisabled.
func (w *CascadeWatcher) IsDisabled() bool {
	return w.restConfig == nil
}

var (
	_ registry.BackgroundService = (*CascadeWatcher)(nil)
	_ registry.CanBeDisabled     = (*CascadeWatcher)(nil)
)
