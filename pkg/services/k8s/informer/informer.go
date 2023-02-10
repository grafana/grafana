package informer

import (
	"context"

	"github.com/google/wire"
)

var WireSet = wire.NewSet(ProvideFactory)

type ResourceWatcher interface {
	OnAdd(ctx context.Context, obj any)
	OnUpdate(ctx context.Context, oldObj, newObj any)
	OnDelete(ctx context.Context, obj any)
}
