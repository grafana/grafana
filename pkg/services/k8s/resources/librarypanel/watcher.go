package librarypanel

import "context"

var _ Watcher = (*watcher)(nil)

type watcher struct{}

func ProvideWatcher() *watcher {
	return &watcher{}
}

func (w *watcher) Add(ctx context.Context, obj *LibraryPanel) {
	// TODO
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *LibraryPanel) {
	// TODO
}

func (w *watcher) Delete(ctx context.Context, obj *LibraryPanel) {
	// TODO
}
