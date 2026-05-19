package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

const defaultCascadeWatcherResync = 60 * time.Second

// CascadeWatcher watches Folder CRs that are terminating with the cascade-delete finalizer.
// Reconcile logic will be added here when cascade delete is implemented.
type CascadeWatcher struct {
	restConfig apiserver.RestConfigProvider
	log        *slog.Logger
	resync     time.Duration
}

func ProvideCascadeWatcher(restConfig apiserver.RestConfigProvider) *CascadeWatcher {
	return &CascadeWatcher{
		restConfig: restConfig,
		log:        slog.Default().With("logger", "folder-cascade-watcher"),
		resync:     defaultCascadeWatcherResync,
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

	w.log.Info("observed terminating folder",
		"namespace", f.Namespace,
		"name", f.Name,
		"deletionTimestamp", f.DeletionTimestamp,
	)
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
