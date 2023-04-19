package team

import "context"

var _ Watcher = (*watcher)(nil)

type watcher struct{}

func ProvideWatcher() Watcher {
	return &watcher{}
}

func (w *watcher) Add(ctx context.Context, obj *Team) error {
	// TODO
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *Team) error {
	// TODO
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *Team) error {
	// TODO
	return nil
}
