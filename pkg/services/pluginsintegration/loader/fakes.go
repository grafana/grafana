package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakeErrorTracker struct {
	RecordFunc func(ctx context.Context, err *plugins.Error)
	ClearFunc  func(ctx context.Context, pluginID string)
	ErrorsFunc func(ctx context.Context) []*plugins.Error
}

func newFakeErrorTracker() *fakeErrorTracker {
	return &fakeErrorTracker{}
}

func (t *fakeErrorTracker) Record(ctx context.Context, err *plugins.Error) {
	if t.RecordFunc != nil {
		t.RecordFunc(ctx, err)
		return
	}
}

func (t *fakeErrorTracker) Clear(ctx context.Context, pluginID string) {
	if t.ClearFunc != nil {
		t.ClearFunc(ctx, pluginID)
		return
	}
}

func (t *fakeErrorTracker) Errors(ctx context.Context) []*plugins.Error {
	if t.ErrorsFunc != nil {
		return t.ErrorsFunc(ctx)
	}
	return nil
}

func (t *fakeErrorTracker) Error(ctx context.Context, pluginID string) *plugins.Error {
	return &plugins.Error{}
}
