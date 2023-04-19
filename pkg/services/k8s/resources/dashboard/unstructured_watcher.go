package dashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type Watcher interface {
	Add(context.Context, *unstructured.Unstructured) error
	Update(context.Context, *unstructured.Unstructured, *unstructured.Unstructured) error
	Delete(context.Context, *unstructured.Unstructured) error
}

type WatcherWrapper struct {
	log     log.Logger
	watcher Watcher
}

func NewWatcherWrapper(watcher Watcher) *WatcherWrapper {
	return &WatcherWrapper{
		log:     log.New("k8s.dashboard.watcher"),
		watcher: watcher,
	}
}

func (w *WatcherWrapper) Add(ctx context.Context, obj any) error {
	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}
	return w.watcher.Add(ctx, uObj)
}

func (w *WatcherWrapper) Update(ctx context.Context, oldObj, newObj any) error {
	convOld, ok := oldObj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}
	convNew, ok := newObj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}
	return w.watcher.Update(ctx, convOld, convNew)
}

func (w *WatcherWrapper) Delete(ctx context.Context, obj any) error {
	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}
	return w.watcher.Delete(ctx, uObj)
}
