package angularinspector

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// FakeInspector is an inspector whose Inspect function can be set to any function.
type FakeInspector struct {
	// InspectFunc is the function called when calling Inspect()
	InspectFunc func(ctx context.Context, p *plugins.Plugin) (bool, error)
}

func (i *FakeInspector) Inspect(ctx context.Context, p *plugins.Plugin) (bool, error) {
	return i.InspectFunc(ctx, p)
}

var (
	// AlwaysAngularFakeInspector is an inspector that always returns `true, nil`
	AlwaysAngularFakeInspector = &FakeInspector{
		InspectFunc: func(_ context.Context, _ *plugins.Plugin) (bool, error) {
			return true, nil
		},
	}

	// NeverAngularFakeInspector is an inspector that always returns `false, nil`
	NeverAngularFakeInspector = &FakeInspector{
		InspectFunc: func(_ context.Context, _ *plugins.Plugin) (bool, error) {
			return false, nil
		},
	}
)
