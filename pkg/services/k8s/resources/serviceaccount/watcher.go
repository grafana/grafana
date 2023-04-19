package serviceaccount

import "context"

var _ Watcher = (*watcher)(nil)

type watcher struct{}

func ProvideWatcher() Watcher {
	return &watcher{}
}

func (w *watcher) Add(ctx context.Context, obj *ServiceAccount) error {
	// TODO
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *ServiceAccount) error {
	// TODO
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *ServiceAccount) error {
	// TODO
	return nil
}
