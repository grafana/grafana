package folder

import "context"

var _ Watcher = (*watcher)(nil)

type watcher struct{}

func ProvideWatcher() *watcher {
	return &watcher{}
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
