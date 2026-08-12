package ctxkey

import "context"

type Key struct{}

func Set(ctx context.Context, data any) context.Context {
	return context.WithValue(ctx, Key{}, data)
}

func Get(ctx context.Context) any {
	return ctx.Value(Key{})
}
