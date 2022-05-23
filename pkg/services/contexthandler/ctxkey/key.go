package ctxkey

import "context"

type Key struct{}

func Set(ctx context.Context, data interface{}) context.Context {
	return context.WithValue(ctx, Key{}, data)
}

func Get(ctx context.Context) interface{} {
	return ctx.Value(Key{})
}
