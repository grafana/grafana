package accesspolicy

import "context"

var _ Watcher = (*watcher)(nil)

type watcher struct{}

func ProvideWatcher() *watcher {
	return &watcher{}
}

func (w *watcher) Add(ctx context.Context, obj *AccessPolicy) error {
	// TODO
	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *AccessPolicy) error {
	// TODO
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *AccessPolicy) error {
	// TODO
	return nil
}
