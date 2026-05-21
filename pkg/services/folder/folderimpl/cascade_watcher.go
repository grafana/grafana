package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	claims "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const defaultCascadeWatcherResync = 60 * time.Second

// folderSearcher is the subset of client.K8sHandler used to list child folders via unified search.
type folderSearcher interface {
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

// folderMutator deletes Folder CRs and removes the cascade finalizer once children are gone.
type folderMutator interface {
	Delete(ctx context.Context, namespace, name string) error
	RemoveCascadeFinalizer(ctx context.Context, namespace, name string) error
}

// CascadeWatcher watches Folder CRs that are terminating with the cascade-delete finalizer
// and drives cascade deletion: it deletes direct child folders, and once a folder has no
// remaining children it removes the cascade finalizer so the folder can be garbage-collected.
//
// Child folder lookups use unified search (folder parent index), not a full folder List or
// informer cache scan, so cost scales with the number of direct children, not org size.
//
// Note: the informer still performs an initial List+Watch of all folder CRs on startup.
// At very large scale, consider replacing it with a targeted watch path.
type CascadeWatcher struct {
	restConfig    apiserver.RestConfigProvider
	folderSearch  folderSearcher
	folderMutator folderMutator
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
		log:          slog.Default().With("logger", "folder-cascade-watcher"),
		resync:       defaultCascadeWatcherResync,
	}
}

// Run implements registry.BackgroundService.
func (w *CascadeWatcher) Run(ctx context.Context) error {
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

	factory := dynamicinformer.NewDynamicSharedInformerFactory(dyn, w.resync)
	informer := factory.ForResource(gvr).Informer()

	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    w.onFolder,
		UpdateFunc: func(_, obj interface{}) { w.onFolder(obj) },
	})

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
	childNames, err := listDirectChildFolderNames(svcCtx, w.folderSearch, orgID, f.Name)
	if err != nil {
		w.log.Warn("failed to list child folders", "namespace", f.Namespace, "name", f.Name, "error", err)
		return
	}

	if len(childNames) == 0 {
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

	w.log.Info("cascading delete to child folders",
		"namespace", f.Namespace,
		"name", f.Name,
		"orgID", orgID,
		"childFolderCount", len(childNames),
	)

	if w.folderMutator == nil {
		return
	}
	for _, child := range childNames {
		if err := w.folderMutator.Delete(svcCtx, f.Namespace, child); err != nil && !apierrors.IsNotFound(err) {
			w.log.Warn("failed to delete child folder", "namespace", f.Namespace, "parent", f.Name, "child", child, "error", err)
		}
	}
}

// listDirectChildFolderNames returns the UIDs of folder CRs whose grafana.app/folder parent
// is parentUID, using unified search (same index as folder store GetDescendants / searchChildren).
func listDirectChildFolderNames(ctx context.Context, searcher folderSearcher, orgID int64, parentUID string) ([]string, error) {
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

	var names []string
	for offset := int64(0); ; {
		resp, err := searcher.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Fields: fields},
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

// dynamicFolderMutator implements folderMutator on top of the folders dynamic client.
type dynamicFolderMutator struct {
	client dynamic.NamespaceableResourceInterface
}

func (d *dynamicFolderMutator) Delete(ctx context.Context, namespace, name string) error {
	return d.client.Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
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
