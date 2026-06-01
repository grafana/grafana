package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
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
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/util/retry"
	"k8s.io/client-go/util/workqueue"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const defaultCascadeWatcherResync = 60 * time.Second

// terminatingFolderSelector limits the cascade watcher's List+Watch to folders the delete
// path has marked terminating, so its cost scales with folders being deleted rather than the
// total number of folders.
var terminatingFolderSelector = folders.TerminatingLabel + "=" + folders.TerminatingLabelValue

// terminatingLabelField is the search return-field carrying the terminating label, so each
// child hit reports whether its own deletion has already begun. It lets the watcher skip
// re-issuing deletes for children already draining, without a second search or lookup.
//
// This relies on the search backend (bleve) echoing back "labels."-prefixed return fields. If a
// backend does not, every child parses as not-terminating and the watcher falls back to
// re-issuing deletes each resync -- still correct (deletes are idempotent), just less efficient.
var terminatingLabelField = resource.SEARCH_FIELD_LABELS + "." + folders.TerminatingLabel

// folderSearcher is the subset of client.K8sHandler used to list child folders via unified search.
type folderSearcher interface {
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

// folderMutator deletes Folder CRs and removes the cascade finalizer once children are gone.
type folderMutator interface {
	Delete(ctx context.Context, namespace, name string, gracePeriodSeconds *int64) error
	RemoveCascadeFinalizer(ctx context.Context, namespace, name string) error
}

// CascadeWatcher watches Folder CRs that are terminating with the cascade-delete finalizer
// and drives cascade deletion: it deletes direct child folders, and once a folder has no
// remaining children it removes the cascade finalizer so the folder can be garbage-collected.
//
// Child folder lookups use unified search (folder parent index), not a full folder List or
// informer cache scan, so cost scales with the number of direct children, not org size.
//
// The informer List+Watches only folders carrying the terminating label (stamped by the
// folder delete path), so its cost scales with the number of folders being deleted rather
// than the total folder count.
//
// Reconciliation runs through a rate-limited workqueue: informer events enqueue keys and a
// worker reconciles them. When a folder is fully removed, its parent key is re-enqueued so the
// parent re-checks its children immediately instead of waiting for the next resync. The queue
// deduplicates, so a wide parent whose children drain together is reconciled a handful of times
// rather than once per child.
type CascadeWatcher struct {
	restConfig    apiserver.RestConfigProvider
	folderSearch  folderSearcher
	folderMutator folderMutator
	flagEnabled   func(ctx context.Context) bool
	log           *slog.Logger
	resync        time.Duration

	queue   workqueue.TypedRateLimitingInterface[string]
	indexer cache.Indexer
}

func ProvideCascadeWatcher(
	cfg *setting.Cfg,
	restConfig apiserver.RestConfigProvider,
	resourceClient resource.ResourceClient,
	userService user.Service,
) *CascadeWatcher {
	folderSearch := client.NewK8sHandler(
		request.GetNamespaceMapper(cfg),
		foldersv1.FolderResourceInfo.GroupVersionResource(),
		restConfig.GetRestConfig,
		userService,
		resourceClient,
	)

	return &CascadeWatcher{
		restConfig:   restConfig,
		folderSearch: folderSearch,
		flagEnabled:  cascadeDeleteFlagEnabled,
		log:          slog.Default().With("logger", "folder-cascade-watcher"),
		resync:       defaultCascadeWatcherResync,
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

	gvr := foldersv1.FolderResourceInfo.GroupVersionResource()
	w.folderMutator = &dynamicFolderMutator{client: dyn.Resource(gvr)}
	w.queue = workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]())

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(
		dyn,
		w.resync,
		metav1.NamespaceAll,
		func(opts *metav1.ListOptions) {
			opts.LabelSelector = terminatingFolderSelector
		},
	)
	informer := factory.ForResource(gvr).Informer()
	w.indexer = informer.GetIndexer()

	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    w.enqueue,
		UpdateFunc: func(_, obj interface{}) { w.enqueue(obj) },
		// When a folder is fully removed, re-check its parent so the parent can drop its own
		// finalizer immediately instead of waiting for the next resync.
		DeleteFunc: w.enqueueParent,
	}); err != nil {
		return fmt.Errorf("add folder informer event handler: %w", err)
	}

	factory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), informer.HasSynced) {
		return fmt.Errorf("sync folder informer cache")
	}

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		w.runWorker(ctx)
	}()

	w.log.Info("folder cascade watcher started")
	<-ctx.Done()
	w.queue.ShutDown()
	wg.Wait()
	return nil
}

// enqueue adds a folder's own key to the workqueue.
func (w *CascadeWatcher) enqueue(obj interface{}) {
	key, err := cache.MetaNamespaceKeyFunc(obj)
	if err != nil {
		w.log.Warn("failed to build folder key", "error", err)
		return
	}
	w.queue.Add(key)
}

// enqueueParent adds the parent of a removed folder to the workqueue, so the parent re-checks
// whether it still has children once a child is gone. The queue deduplicates, so children of the
// same parent draining together collapse into a small number of parent reconciles.
func (w *CascadeWatcher) enqueueParent(obj interface{}) {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}
	f, ok := asFolderCR(obj)
	if !ok {
		return
	}
	parent := f.GetAnnotations()[utils.AnnoKeyFolder]
	if parent == "" {
		return // root-level folder: no parent to re-check
	}
	w.queue.Add(f.Namespace + "/" + parent)
}

func (w *CascadeWatcher) runWorker(ctx context.Context) {
	for w.processNext(ctx) {
	}
}

func (w *CascadeWatcher) processNext(ctx context.Context) bool {
	key, shutdown := w.queue.Get()
	if shutdown {
		return false
	}
	defer w.queue.Done(key)

	if err := w.reconcile(ctx, key); err != nil {
		w.log.Warn("folder cascade reconcile failed, requeueing", "key", key, "error", err)
		w.queue.AddRateLimited(key)
		return true
	}
	w.queue.Forget(key)
	return true
}

// reconcile looks the folder up in the informer cache and drives its cascade state. A missing
// folder (already garbage-collected) is a no-op.
func (w *CascadeWatcher) reconcile(ctx context.Context, key string) error {
	obj, exists, err := w.indexer.GetByKey(key)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	f, ok := asFolderCR(obj)
	if !ok {
		w.log.Warn("cached object is not a folder", "key", key)
		return nil
	}
	return w.reconcileFolder(ctx, f)
}

func (w *CascadeWatcher) reconcileFolder(ctx context.Context, f *foldersv1.Folder) error {
	if !isTerminatingForCascade(f) {
		return nil
	}

	orgID, err := orgIDFromNamespace(f.Namespace)
	if err != nil {
		// A malformed namespace will not fix itself, so do not requeue.
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
	// own finalizers, so re-issuing a delete each resync would be redundant.
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
