package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/folder"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	dashboardStore database.DashboardSQLStore
	folders        folder.FolderStore
}

func ProvideWatcher(
	dashboardStore database.DashboardSQLStore,
	folders folder.FolderStore) Watcher {
	return &watcher{dashboardStore, folders}
}

func (w *watcher) Add(ctx context.Context, obj *Folder) error {
	// TODO
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *Folder) error {
	// TODO
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *Folder) error {
	// TODO
	return nil
}
