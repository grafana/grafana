package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// reconnectDelay is how long to wait before re-establishing a dropped watch.
const reconnectDelay = 30 * time.Second

// DeletedFolderWatcher establishes a k8s watch on folder.grafana.app folders
// and logs deletions. It is intentionally minimal: it only reacts to delete
// events and it is fine to miss events (e.g. across a reconnect), so it keeps
// no cache and tracks no resource version.
//
// Watches are scoped to the namespaces that exist in this Grafana database (one
// per org, deduplicated) rather than cluster-wide, because a single stack hosts
// multiple orgs in one database. The org list is read once at startup; creating
// a new org requires a restart to start watching its namespace.
type DeletedFolderWatcher struct {
	restConfigProvider apiserver.RestConfigProvider
	orgService         org.Service
	namespaceMapper    request.NamespaceMapper
	features           featuremgmt.FeatureToggles
	log                *slog.Logger
}

func ProvideDeletedFolderWatcher(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	orgService org.Service,
	features featuremgmt.FeatureToggles,
) *DeletedFolderWatcher {
	return &DeletedFolderWatcher{
		restConfigProvider: restConfigProvider,
		orgService:         orgService,
		namespaceMapper:    request.GetNamespaceMapper(cfg),
		features:           features,
		log:                slog.Default().With("logger", "deleted-folder-watcher"),
	}
}

func (w *DeletedFolderWatcher) IsDisabled() bool {
	return !w.features.IsEnabledGlobally(featuremgmt.FlagKubernetesFolderCascadeDelete)
}

// Run watches every org namespace until the context is cancelled. The org list
// is read once; a restart is needed to pick up orgs created afterwards.
func (w *DeletedFolderWatcher) Run(ctx context.Context) error {
	namespaces, err := w.namespaces(ctx)
	if err != nil {
		return fmt.Errorf("failed to list org namespaces: %w", err)
	}

	var wg sync.WaitGroup
	for _, namespace := range namespaces {
		wg.Add(1)
		go func(namespace string) {
			defer wg.Done()
			w.runNamespace(ctx, namespace)
		}(namespace)
	}
	wg.Wait()
	return nil
}

// namespaces returns the distinct namespaces for the orgs in this database. In
// cloud all orgs map to a single stack namespace; on-prem each org maps to its
// own, hence the dedup.
func (w *DeletedFolderWatcher) namespaces(ctx context.Context) ([]string, error) {
	orgs, err := w.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(orgs))
	namespaces := make([]string, 0, len(orgs))
	for _, o := range orgs {
		namespace := w.namespaceMapper(o.ID)
		if _, ok := seen[namespace]; ok {
			continue
		}
		seen[namespace] = struct{}{}
		namespaces = append(namespaces, namespace)
	}
	return namespaces, nil
}

// runNamespace keeps a watch open for a single namespace, reconnecting after a
// delay until the context is cancelled.
func (w *DeletedFolderWatcher) runNamespace(ctx context.Context, namespace string) {
	for {
		w.watchNamespace(ctx, namespace)
		if err := ctx.Err(); err != nil {
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(reconnectDelay):
		}
	}
}

func (w *DeletedFolderWatcher) watchNamespace(ctx context.Context, namespace string) {
	cfg, err := w.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		w.log.Error("failed to get rest config", "namespace", namespace, "error", err)
		return
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		w.log.Error("failed to create dynamic client", "namespace", namespace, "error", err)
		return
	}

	wt, err := dyn.Resource(folderv1.FolderResourceInfo.GroupVersionResource()).Namespace(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			w.log.Error("failed to establish folder watch", "namespace", namespace, "error", err)
		}
		return
	}
	defer wt.Stop()

	w.log.Info("watching for deleted folders", "namespace", namespace)

	for ev := range wt.ResultChan() {
		switch ev.Type {
		case watch.Deleted:
			w.onDeleted(ev.Object)
		case watch.Error:
			w.log.Error("error during folder watch", "namespace", namespace)
			return
		}
	}
}

func (w *DeletedFolderWatcher) onDeleted(obj any) {
	folder, ok := obj.(*unstructured.Unstructured)
	if !ok {
		w.log.Warn("received delete event with unexpected object type", "type", obj)
		return
	}

	w.log.Info("folder deleted", "name", folder.GetName(), "namespace", folder.GetNamespace())
}
