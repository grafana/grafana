package serviceaccount

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
		log: log.New("k8s.serviceaccount.watcher"),
	}
	return &w, nil
}

func (w *watcher) Add(ctx context.Context, obj *ServiceAccount) error {
	w.log.Debug("adding ServiceAccount", "obj", obj)
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *ServiceAccount) error {
	w.log.Debug("updating ServiceAccount", "oldObj", oldObj, "newObj", newObj)
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *ServiceAccount) error {
	w.log.Debug("deleting ServiceAccount", "obj", obj)
	return nil
}
