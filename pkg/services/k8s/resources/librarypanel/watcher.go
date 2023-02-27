package librarypanel

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	log log.Logger
}

func ProvideWatcher() (*watcher, error) {
	w := watcher{
		log: log.New("k8s.librarypanel.watcher"),
	}
	return &w, nil
}

func (w *watcher) Add(ctx context.Context, obj *LibraryPanel) error {
	w.log.Debug("adding LibraryPanel", "obj", obj)
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *LibraryPanel) error {
	w.log.Debug("updating LibraryPanel", "oldObj", oldObj, "newObj", newObj)
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *LibraryPanel) error {
	w.log.Debug("deleting LibraryPanel", "obj", obj)
	return nil
}
