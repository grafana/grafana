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
	defaultCascadePollInterval = 60 * time.Second
	// cascadeLockName is the serverlock action name guarding the sweep, so only one Grafana
	// instance runs it per interval in an HA deployment.
	cascadeLockName = "folder-cascade-delete"
	// cascadePollIntervalKey is read from the folder resource's unified storage section
	// ([unified_storage.folders.folder.grafana.app]), so it sits with the rest of that resource's config.
	cascadePollIntervalKey = "cascade_delete_poll_interval"
)

// terminatingLabelField is the search return-field carrying the terminating label, so a child
// hit reports whether its own deletion has already begun. It lets the poller skip re-issuing
// deletes for children already draining, without a second search or lookup.
//
// This relies on the search backend (bleve) echoing back "labels."-prefixed return fields. If a
// backend does not, every child parses as not-terminating and the poller falls back to
// re-issuing deletes each tick -- still correct (deletes are idempotent), just less efficient.
var terminatingLabelField = resource.SEARCH_FIELD_LABELS + "." + folders.TerminatingLabel

// folderSearcher is the subset of client.K8sHandler used to search folders via unified search.
type folderSearcher interface {
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

// folderMutator deletes Folder CRs and removes the cascade finalizer once children are gone.
type folderMutator interface {
	Delete(ctx context.Context, namespace, name string, gracePeriodSeconds *int64) error
	// RemoveCascadeFinalizer removes the cascade finalizer, but only if the folder is actually
	// terminating (has a deletion timestamp). It reports whether the folder was terminating: if
	// false, the finalizer was deliberately left in place because the folder carries the terminating
	// label but never had its deletion timestamp set (a crashed/interrupted delete), and removing the
	// finalizer would strand it alive forever. The caller resumes the delete instead.
	RemoveCascadeFinalizer(ctx context.Context, namespace, name string) (terminating bool, err error)
	// StripCascadeMetadata reverts a folder that carries the terminating label but has no deletion
	// timestamp -- a stray label from an interrupted delete -- back to an ordinary folder by removing
	// the cascade finalizer and the label, so nothing misleads the poller if the feature is later
	// re-enabled. A folder that is actually terminating (deletion timestamp set) is an in-flight
	// cascade and is left finalized: the flag-off drain does not delete folder contents or mark child
	// folders, so stripping its finalizer would orphan them.
	StripCascadeMetadata(ctx context.Context, namespace, name string) error
}

// orgLister enumerates organizations; the poller searches each org once per tick.
type orgLister interface {
	Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error)
}

// folderContentsDeleter deletes the non-folder resources contained in folders (dashboards,
// library elements, alert rules) via the folder service registry. *Service satisfies it.
type folderContentsDeleter interface {
	deleteChildrenInFolder(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error
}

// CascadePoller drives terminating folders to completion. The folders API server marks a deleted
// folder terminating and best-effort marks its subtree asynchronously; this poller is the source
// of truth: every poll interval it enumerates orgs and, per org, searches for folders carrying the
// terminating label. For each one it marks any not-yet-terminating direct child folders terminating
// (so the mark always reaches the leaves even if the API server's async pass didn't finish), and
// once every child folder is at least marked terminating it deletes the folder's contained resources
// (dashboards, library elements, alert rules) and then removes the finalizer so the folder can be
// garbage-collected. A folder is finalized as soon as its children are marked -- it does not wait for
// them to be physically removed -- because every terminating folder is tracked by its label
// independent of its parent. So once marking reaches the leaves the whole subtree drains in a single
// tick rather than one level per tick.
//
// Discovery is a periodic poll, not a List+Watch: one search per org per tick, cheap when nothing
// is terminating thanks to the label filter. The sweep is guarded by serverlock so only one
// Grafana instance runs it per interval in an HA deployment.
type CascadePoller struct {
	restConfig      apiserver.RestConfigProvider
	orgs            orgLister
	namespaceMapper request.NamespaceMapper
	folderSearch    folderSearcher
	folderMutator   folderMutator
	contentsDeleter folderContentsDeleter
	serverLock      *serverlock.ServerLockService
	flagEnabled     func(ctx context.Context) bool
	log             *slog.Logger
	pollInterval    time.Duration
}

func ProvideCascadePoller(
	cfg *setting.Cfg,
	restConfig apiserver.RestConfigProvider,
	resourceClient resource.ResourceClient,
	userService user.Service,
	orgService org.Service,
	serverLock *serverlock.ServerLockService,
	folderService *Service,
) *CascadePoller {
	folderSearch := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		foldersv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)

	pollInterval := cfg.SectionWithEnvOverrides("unified_storage." + setting.FolderResource).
		Key(cascadePollIntervalKey).MustDuration(defaultCascadePollInterval)

	return &CascadePoller{
		restConfig:      restConfig,
		orgs:            orgService,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		folderSearch:    folderSearch,
		contentsDeleter: folderService,
		serverLock:      serverLock,
		flagEnabled:     cascadeDeleteFlagEnabled,
		log:             slog.Default().With("logger", "folder-cascade-poller"),
		pollInterval:    pollInterval,
	}
}

// cascadeDeleteFlagEnabled reports whether the cascade-delete feature is on. The poller reads
// it once, at startup, in Run.
//
// This is a second, independent boot-time read of the same flag that the folders API builder
// captures in storageForVersion (FolderAPIBuilder.cascadeDeleteEnabled), which gates both the
// finalizer storage wrapper and admission finalizer stamping. The two must agree: if admission
// stamps the cascade finalizer but this poller is not running, deleted folders would stay stuck
// terminating with nothing to remove their finalizer.
//
// When the folders API server runs in the same process as this poller, they agree because both
// read the same flag at process startup; the flag is treated as static for the process lifetime,
// so changing it (including per-tenant in a dynamic provider) requires a restart. But the API
// server can also be deployed as a separate process from the Grafana process that runs this
// poller. In that split deployment the two reads happen in different processes, so agreement
// depends on both being configured with the same flag value and rolled out together; a mismatch
// (flag on for the API server, off where the poller runs) reintroduces the stuck-terminating risk.
func cascadeDeleteFlagEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesFolderCascadeDelete,
		false,
		openfeature.TransactionContext(ctx),
	)
}

// Run implements registry.BackgroundService.
func (cp *CascadePoller) Run(ctx context.Context) error {
	restCfg, err := cp.restConfig.GetRestConfig(ctx)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		cp.log.Debug("folder cascade poller not started", "reason", err)
		return nil
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("create folder dynamic client: %w", err)
	}

	cp.folderMutator = &dynamicFolderMutator{client: dyn.Resource(foldersv1.FolderResourceInfo.GroupVersionResource())}

	// Feature disabled: the API server no longer drives cascades, but folders deleted while it was
	// enabled may still be stuck Terminating with the finalizer and nothing to remove it. Drain those
	// once (strip their finalizers so they complete), then stop -- no ongoing polling is needed.
	if cp.flagEnabled == nil || !cp.flagEnabled(ctx) {
		cp.log.Info("folder cascade poller disabled; draining leftover terminating folders", "flag", featuremgmt.FlagKubernetesFolderCascadeDelete)
		cp.drainTerminatingFolders(ctx)
		return nil
	}

	ticker := time.NewTicker(cp.pollInterval)
	defer ticker.Stop()

	cp.log.Info("folder cascade poller started", "pollInterval", cp.pollInterval)
	cp.sweep(ctx)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			cp.sweep(ctx)
		}
	}
}

// drainTerminatingFolders cleans up folders left labeled terminating when the feature is disabled.
// A folder that carries the label but never got a deletion timestamp (an interrupted delete) is
// reverted to an ordinary folder, so no stray label remains to make the poller cascade it if the
// feature is later re-enabled. A folder that is actually terminating (deletion timestamp set) is an
// in-flight cascade and is left finalized rather than stripped: this drain does not delete folder
// contents or mark child folders, so stripping its finalizer would orphan them -- it stays
// Terminating until the feature is re-enabled and the poller completes it. This runs once at
// startup: with the feature off no new terminating folders appear.
func (cp *CascadePoller) drainTerminatingFolders(ctx context.Context) {
	if cp.folderMutator == nil {
		return
	}
	orgs, err := cp.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		cp.log.Warn("folder cascade drain: list orgs failed", "error", err)
		return
	}
	for _, o := range orgs {
		select {
		case <-ctx.Done():
			return
		default:
		}
		svcCtx := identity.WithServiceIdentityContext(ctx, o.ID)
		names, err := searchTerminatingFolders(svcCtx, cp.folderSearch, o.ID)
		if err != nil {
			cp.log.Warn("folder cascade drain: search terminating folders failed", "orgID", o.ID, "error", err)
			continue
		}
		ns := cp.namespaceMapper(o.ID)
		for _, name := range names {
			if err := cp.folderMutator.StripCascadeMetadata(svcCtx, ns, name); err != nil && !apierrors.IsNotFound(err) {
				cp.log.Warn("folder cascade drain: strip cascade metadata failed", "namespace", ns, "name", name, "error", err)
			}
		}
	}
}

// sweep runs one poll, guarded by serverlock so only one Grafana instance does it per interval.
func (cp *CascadePoller) sweep(ctx context.Context) {
	if cp.serverLock == nil {
		cp.pollOnce(ctx)
		return
	}
	if err := cp.serverLock.LockAndExecute(ctx, cascadeLockName, cp.pollInterval, cp.pollOnce); err != nil {
		cp.log.Warn("folder cascade poll: serverlock failed", "error", err)
	}
}

// pollOnce reconciles terminating folders across all orgs once.
func (cp *CascadePoller) pollOnce(ctx context.Context) {
	orgs, err := cp.orgs.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		cp.log.Warn("folder cascade poll: list orgs failed", "error", err)
		return
	}
	for _, o := range orgs {
		select {
		case <-ctx.Done():
			return
		default:
		}
		cp.reconcileOrg(ctx, o.ID)
	}
}

// reconcileOrg searches one org for terminating folders and finalizes each.
func (cp *CascadePoller) reconcileOrg(ctx context.Context, orgID int64) {
	svcCtx := identity.WithServiceIdentityContext(ctx, orgID)

	names, err := searchTerminatingFolders(svcCtx, cp.folderSearch, orgID)
	if err != nil {
		cp.log.Warn("folder cascade poll: search terminating folders failed", "orgID", orgID, "error", err)
		return
	}

	ns := cp.namespaceMapper(orgID)
	for _, name := range names {
		cp.finalizeTerminatingFolder(svcCtx, orgID, ns, name)
	}
}

// finalizeTerminatingFolder advances one terminating folder. Any not-yet-terminating direct child
// folders are marked terminating first. A successful mark makes the child terminating synchronously
// (the API server stamps the terminating label and deletion timestamp before returning), so once
// every child is terminating -- already, or just marked without error -- the folder's contained
// resources are deleted and its finalizer removed, all in the same tick. Only if a child cannot be
// marked does the folder keep its finalizer and retry next tick.
//
// A folder is finalized as soon as its children are *marked* -- it does not wait for them to be
// physically removed. That is safe because every terminating folder is tracked by its label
// independent of its parent, so removing a parent before its terminating children are gone cannot
// lose a child. The benefit is that a fully-marked subtree collapses in a single tick instead of one
// level per tick.
func (cp *CascadePoller) finalizeTerminatingFolder(ctx context.Context, orgID int64, namespace, name string) {
	if cp.folderMutator == nil {
		return
	}

	children, err := listDirectChildFolders(ctx, cp.folderSearch, orgID, name)
	if err != nil {
		cp.log.Warn("folder cascade poll: list child folders failed", "namespace", namespace, "name", name, "error", err)
		return
	}

	// Mark any not-yet-terminating child folders so the mark always reaches the leaves, even if the
	// API server's async pass did not finish. A successful mark (or NotFound -- the child is already
	// gone) leaves the child terminating synchronously, so it does not block finalizing this folder
	// in the same tick. Only a real mark failure does.
	zero := int64(0)
	allChildrenTerminating := true
	for _, child := range children {
		if child.terminating {
			continue
		}
		if err := cp.folderMutator.Delete(ctx, namespace, child.name, &zero); err != nil && !apierrors.IsNotFound(err) {
			cp.log.Warn("folder cascade poll: mark child terminating failed", "namespace", namespace, "parent", name, "child", child.name, "error", err)
			allChildrenTerminating = false
		}
	}

	if !allChildrenTerminating {
		return // a child could not be marked; keep the finalizer and retry next tick
	}

	// Every child folder is marked terminating: delete this folder's contained resources (dashboards,
	// library elements, alert rules) before removing the finalizer, so they aren't orphaned by GC.
	if err := cp.deleteFolderContents(ctx, orgID, name); err != nil {
		cp.log.Warn("folder cascade poll: delete folder contents failed", "namespace", namespace, "name", name, "error", err)
		return // keep the finalizer and retry next tick
	}
	terminating, err := cp.folderMutator.RemoveCascadeFinalizer(ctx, namespace, name)
	if err != nil && !apierrors.IsNotFound(err) {
		cp.log.Warn("folder cascade poll: remove finalizer failed", "namespace", namespace, "name", name, "error", err)
		return
	}
	if !terminating {
		// The folder carries the terminating label but has no deletion timestamp: its delete was
		// interrupted before the timestamp was set. Resume it with a force delete so it is actually
		// removed; next tick it has a deletion timestamp and the finalizer comes off normally.
		if err := cp.folderMutator.Delete(ctx, namespace, name, &zero); err != nil && !apierrors.IsNotFound(err) {
			cp.log.Warn("folder cascade poll: resume interrupted delete failed", "namespace", namespace, "name", name, "error", err)
		}
	}
}

// deleteFolderContents deletes the non-folder resources contained in folderUID (dashboards,
// library elements, alert rules) via the folder service registry, under the poller's service
// identity.
func (cp *CascadePoller) deleteFolderContents(ctx context.Context, orgID int64, folderUID string) error {
	if cp.contentsDeleter == nil {
		return nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	return cp.contentsDeleter.deleteChildrenInFolder(ctx, orgID, []string{folderUID}, user)
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

func (d *dynamicFolderMutator) RemoveCascadeFinalizer(ctx context.Context, namespace, name string) (bool, error) {
	terminating := false
	err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := d.client.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		// Gate on the deletion timestamp: a folder can carry the terminating label without ever
		// having had its deletion timestamp set (the delete was interrupted between stamping the
		// label and the store delete). Removing its finalizer then would strand it alive forever, so
		// leave the finalizer in place and report not-terminating; the caller resumes the delete.
		if ts := obj.GetDeletionTimestamp(); ts == nil || ts.IsZero() {
			terminating = false
			return nil
		}
		terminating = true

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
	return terminating, err
}

func (d *dynamicFolderMutator) StripCascadeMetadata(ctx context.Context, namespace, name string) error {
	return retry.RetryOnConflict(retry.DefaultRetry, func() error {
		obj, err := d.client.Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return err
		}

		// Leave an in-flight cascade finalized rather than stripping it. A folder with a deletion
		// timestamp was already accepted for delete while the feature was on; removing its finalizer
		// here lets storage delete it at once, but the flag-off drain never deletes the folder's
		// contents or marks its child folders, so dashboards, alert rules, library elements, and
		// children would be orphaned. It stays Terminating until the feature is re-enabled and the
		// poller completes it.
		if ts := obj.GetDeletionTimestamp(); ts != nil && !ts.IsZero() {
			return nil
		}

		finalizers := obj.GetFinalizers()
		remaining := make([]string, 0, len(finalizers))
		for _, fin := range finalizers {
			if fin != folders.CascadeDeleteFinalizer {
				remaining = append(remaining, fin)
			}
		}

		labels := obj.GetLabels()
		_, hasLabel := labels[folders.TerminatingLabel]

		// Nothing to strip.
		if len(remaining) == len(finalizers) && !hasLabel {
			return nil
		}

		obj.SetFinalizers(remaining)
		if hasLabel {
			delete(labels, folders.TerminatingLabel)
			obj.SetLabels(labels)
		}
		_, err = d.client.Namespace(namespace).Update(ctx, obj, metav1.UpdateOptions{})
		return err
	})
}

// IsDisabled implements registry.CanBeDisabled.
func (cp *CascadePoller) IsDisabled() bool {
	return cp.restConfig == nil
}

var (
	_ registry.BackgroundService = (*CascadePoller)(nil)
	_ registry.CanBeDisabled     = (*CascadePoller)(nil)
)
