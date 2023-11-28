package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakeSignatureErrorTracker struct {
	RecordFunc          func(ctx context.Context, err *plugins.SignatureError)
	ClearFunc           func(ctx context.Context, pluginID string)
	SignatureErrorsFunc func(ctx context.Context) []*plugins.SignatureError
}

func newFakeSignatureErrorTracker() *fakeSignatureErrorTracker {
	return &fakeSignatureErrorTracker{}
}

func (t *fakeSignatureErrorTracker) Record(ctx context.Context, err *plugins.SignatureError) {
	if t.RecordFunc != nil {
		t.RecordFunc(ctx, err)
		return
	}
}

func (t *fakeSignatureErrorTracker) Clear(ctx context.Context, pluginID string) {
	if t.ClearFunc != nil {
		t.ClearFunc(ctx, pluginID)
		return
	}
}

func (t *fakeSignatureErrorTracker) SignatureErrors(ctx context.Context) []*plugins.SignatureError {
	if t.SignatureErrorsFunc != nil {
		return t.SignatureErrorsFunc(ctx)
	}
	return nil
}
