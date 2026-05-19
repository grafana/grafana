package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	claims "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"

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

// folderSearcher is the subset of client.K8sHandler used to count child folders via unified search.
type folderSearcher interface {
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

// CascadeWatcher watches Folder CRs that are terminating with the cascade-delete finalizer.
// Reconcile logic will be added here when cascade delete is implemented.
//
// Child folder counts use unified search (folder parent index), not a full folder List or
// informer cache scan, so cost scales with the number of direct children, not org size.
//
// Note: the informer still performs an initial List+Watch of all folder CRs on startup.
// At very large scale, consider replacing it with a targeted watch path.
type CascadeWatcher struct {
	restConfig   apiserver.RestConfigProvider
	folderSearch folderSearcher
	log          *slog.Logger
	resync       time.Duration
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
	childCount, err := countDirectChildFolders(svcCtx, w.folderSearch, orgID, f.Name)
	if err != nil {
		w.log.Warn("failed to count child folders", "namespace", f.Namespace, "name", f.Name, "error", err)
		return
	}

	w.log.Info("observed terminating folder",
		"namespace", f.Namespace,
		"name", f.Name,
		"orgID", orgID,
		"deletionTimestamp", f.DeletionTimestamp,
		"childFolderCount", childCount,
	)
}

// countDirectChildFolders counts folder CRs whose grafana.app/folder parent is parentUID
// using unified search (same index as folder store GetDescendants / searchChildren).
func countDirectChildFolders(ctx context.Context, searcher folderSearcher, orgID int64, parentUID string) (int, error) {
	if searcher == nil {
		return 0, nil
	}
	if parentUID == folder.GeneralFolderUID {
		parentUID = ""
	}

	fields := []*resourcepb.Requirement{{
		Key:      resource.SEARCH_FIELD_FOLDER,
		Operator: string(selection.In),
		Values:   []string{parentUID},
	}}

	var total int
	for offset := int64(0); ; {
		resp, err := searcher.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Fields: fields},
			Limit:   searchPageSize,
			Offset:  offset,
		})
		if err != nil {
			return 0, err
		}

		parsed, err := dashboardsearch.ParseResults(resp, 0)
		if err != nil {
			return 0, err
		}

		n := len(parsed.Hits)
		total += n
		if int64(n) < searchPageSize {
			return total, nil
		}
		offset += int64(n)
	}
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
