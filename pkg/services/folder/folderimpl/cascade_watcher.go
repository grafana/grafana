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
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
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
type CascadeWatcher struct {
	restConfig    apiserver.RestConfigProvider
	folderSearch  folderSearcher
	folderMutator folderMutator
	flagEnabled   func(ctx context.Context) bool
	log           *slog.Logger
	resync        time.Duration
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

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(
		dyn,
		w.resync,
		metav1.NamespaceAll,
		func(opts *metav1.ListOptions) {
			opts.LabelSelector = terminatingFolderSelector
		},
	)
	informer := factory.ForResource(gvr).Informer()

	if _, err := informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    w.onFolder,
		UpdateFunc: func(_, obj interface{}) { w.onFolder(obj) },
	}); err != nil {
		return fmt.Errorf("add folder informer event handler: %w", err)
	}

	factory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), informer.HasSynced) {
		return fmt.Errorf("sync folder informer cache")
	}

	w.log.Info("folder cascade watcher started")
	<-ctx.Done()
	return nil
}

func (w *CascadeWatcher) onFolder(obj interface{}) {
	f, ok := asFolderCR(obj)
	if !ok || !isTerminatingForCascade(f) {
		return
	}

	orgID, err := orgIDFromNamespace(f.Namespace)
	if err != nil {
		w.log.Warn("failed to resolve org for terminating folder", "namespace", f.Namespace, "name", f.Name, "error", err)
		return
	}

	svcCtx := identity.WithServiceIdentityContext(context.Background(), orgID)
	children, err := listDirectChildFolders(svcCtx, w.folderSearch, orgID, f.Name)
	if err != nil {
		w.log.Warn("failed to list child folders", "namespace", f.Namespace, "name", f.Name, "error", err)
		return
	}

	// The parent keeps its finalizer until the whole subtree is gone: removal is gated on the
	// total child count, including children still terminating, not just the ones deleted below.
	if len(children) == 0 {
		if w.folderMutator == nil {
			return
		}
		if err := w.folderMutator.RemoveCascadeFinalizer(svcCtx, f.Namespace, f.Name); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("failed to remove cascade finalizer", "namespace", f.Namespace, "name", f.Name, "error", err)
			return
		}
		w.log.Info("removed cascade finalizer", "namespace", f.Namespace, "name", f.Name, "orgID", orgID)
		return
	}

	if w.folderMutator == nil {
		return
	}

	// Only delete children that are not already terminating; the rest are draining via their
	// own finalizers, so re-issuing a delete each resync would be redundant.
	gracePeriod := f.DeletionGracePeriodSeconds
	deleted := 0
	for _, child := range children {
		if child.terminating {
			continue
		}
		if err := w.folderMutator.Delete(svcCtx, f.Namespace, child.name, gracePeriod); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("failed to delete child folder", "namespace", f.Namespace, "parent", f.Name, "child", child.name, "error", err)
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
