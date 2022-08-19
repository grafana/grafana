package util

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWithCancelWithReason(t *testing.T) {
	t.Run("should add custom reason to the standard error", func(t *testing.T) {
		expected := errors.New("test-err")
		ctx, fn := WithCancelCause(context.Background())
		fn(expected)
		select {
		case <-ctx.Done():
		default:
			require.Fail(t, "the context was not cancelled")
		}
		require.ErrorIs(t, ctx.Err(), expected)
		require.ErrorIs(t, ctx.Err(), context.Canceled)
	})

	t.Run("should return only the first reason if called multiple times", func(t *testing.T) {
		expected := errors.New("test-err")
		ctx, fn := WithCancelCause(context.Background())
		fn(expected)
		fn(errors.New("other error"))
		require.ErrorIs(t, ctx.Err(), expected)
	})

	t.Run("should return only the first reason if called multiple times", func(t *testing.T) {
		expected := errors.New("test-err")
		ctx, fn := WithCancelCause(context.Background())
		fn(expected)
		fn(errors.New("other error"))
		require.ErrorIs(t, ctx.Err(), expected)
	})

	t.Run("should return context.Canceled if no reason provided", func(t *testing.T) {
		ctx, fn := WithCancelCause(context.Background())
		fn(nil)
		require.Equal(t, ctx.Err(), context.Canceled)
	})
}
