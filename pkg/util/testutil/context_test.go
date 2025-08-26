package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opencensus.io/stats/view"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/util/testutil/mocks"
)

func TestMain(m *testing.M) {
	view.Stop()
	// make sure we don't leak goroutines after tests in this package have
	// finished, which means we haven't leaked contexts either
	goleak.VerifyTestMain(m)
}

func TestTestContextFunc(t *testing.T) {
	t.Parallel()

	const tolerance = 100 * time.Millisecond

	t.Run("no explicit deadline - no test deadline", func(t *testing.T) {
		t.Parallel()

		tt := mocks.NewT(t)
		tt.EXPECT().Helper()
		tt.EXPECT().Deadline().Return(time.Time{}, false).Once()
		tt.EXPECT().Cleanup(mock.Anything).Once()

		ctx := NewDefaultTestContext(tt)
		d, ok := ctx.Deadline()
		require.True(t, ok)
		require.False(t, d.IsZero())
		diff := time.Now().Add(DefaultContextTimeout).Sub(d)
		require.GreaterOrEqual(t, diff, time.Duration(0))
		require.Less(t, diff, tolerance)

		ctx.Cancel()
		require.ErrorIs(t, ctx.Err(), context.Canceled)

		// already canceled, we shouldn't be able to set a cause now
		ctx.CancelCause(context.DeadlineExceeded)
		require.ErrorIs(t, context.Cause(ctx), context.Canceled)

		select {
		case <-ctx.Done():
		default:
			t.Fatalf("done channel not closed")
		}
	})

	t.Run("explicit deadline - earlier test deadline", func(t *testing.T) {
		t.Parallel()

		// make sure the context will be deadlined already at creation
		now := time.Now().Add(-time.Second)

		tt := mocks.NewT(t)
		tt.EXPECT().Helper()
		tt.EXPECT().Deadline().Return(now, true).Once()
		tt.EXPECT().Cleanup(mock.Anything).Once()

		ctx := NewTestContext(tt, now.Add(time.Second))
		d, ok := ctx.Deadline()
		require.True(t, ok)
		require.Equal(t, now, d)
		require.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)
	})

	t.Run("explicit deadline - later test deadline", func(t *testing.T) {
		t.Parallel()

		now := time.Now().Add(-time.Second)

		tt := mocks.NewT(t)
		tt.EXPECT().Helper()
		tt.EXPECT().Deadline().Return(now.Add(time.Hour), true).Once()
		tt.EXPECT().Cleanup(mock.Anything).Once()

		ctx := NewTestContext(tt, now)
		d, ok := ctx.Deadline()
		require.True(t, ok)
		require.Equal(t, now, d)
		require.ErrorIs(t, ctx.Err(), context.DeadlineExceeded)
	})
}
