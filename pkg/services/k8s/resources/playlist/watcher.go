package playlist

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
		log: log.New("k8s.playlist.watcher"),
	}
	return &w, nil
}

func (w *watcher) Add(ctx context.Context, obj *Playlist) error {
	w.log.Debug("adding Playlist", "obj", obj)
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *Playlist) error {
	w.log.Debug("updating Playlist", "oldObj", oldObj, "newObj", newObj)
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *Playlist) error {
	w.log.Debug("deleting Playlist", "obj", obj)
	return nil
}
