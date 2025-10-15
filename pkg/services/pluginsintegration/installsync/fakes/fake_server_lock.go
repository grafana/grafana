package fakes

import (
	"context"
	"time"
)

type FakeServerLock struct {
	LockExecuteAndReleaseFunc func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func NewFakeServerLock() *FakeServerLock {
	return &FakeServerLock{
		LockExecuteAndReleaseFunc: func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
			fn(ctx)
			return nil
		},
	}
}

func (f *FakeServerLock) LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	if f.LockExecuteAndReleaseFunc != nil {
		return f.LockExecuteAndReleaseFunc(ctx, actionName, maxInterval, fn)
	}
	fn(ctx)
	return nil
}
