package team

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
		log: log.New("k8s.team.watcher"),
	}
	return &w, nil
}

func (w *watcher) Add(ctx context.Context, obj *Team) error {
	w.log.Debug("adding Team", "obj", obj)
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *Team) error {
	w.log.Debug("updating Team", "oldObj", oldObj, "newObj", newObj)
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *Team) error {
	w.log.Debug("deleting Team", "obj", obj)
	return nil
}
