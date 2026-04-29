package cluster

import (
	"context"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

type mockPositionProvider struct {
	position atomic.Int32
}

func (m *mockPositionProvider) Position() int {
	return int(m.position.Load())
}

func TestNewEvaluationCoordinator(t *testing.T) {
	t.Run("returns error when cluster is nil", func(t *testing.T) {
		coordinator, err := NewEvaluationCoordinator(nil, log.NewNopLogger())
		require.ErrorContains(t, err, "cluster position provider is required")
		require.Nil(t, coordinator)
	})

	t.Run("succeeds with valid cluster", func(t *testing.T) {
		coordinator, err := NewEvaluationCoordinator(&mockPositionProvider{}, log.NewNopLogger())
		require.NoError(t, err)
		require.NotNil(t, coordinator)
	})
}

func TestEvaluationCoordinator_shouldEvaluate(t *testing.T) {
	testCases := []struct {
		name     string
		position int
		expected bool
	}{
		{"position 0 should evaluate", 0, true},
		{"position 1 should not evaluate", 1, false},
		{"position 2 should not evaluate", 2, false},
		{"negative position should not evaluate", -1, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			provider := &mockPositionProvider{}
			provider.position.Store(int32(tc.position))
			coordinator, err := NewEvaluationCoordinator(provider, log.NewNopLogger())
			require.NoError(t, err)
			require.Equal(t, tc.expected, coordinator.shouldEvaluate())
		})
	}
}

func TestEvaluationCoordinator_Updates(t *testing.T) {
	t.Run("emits initial value immediately", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			provider := &mockPositionProvider{}
			coordinator, err := NewEvaluationCoordinator(provider, log.NewNopLogger())
			require.NoError(t, err)

			updates := coordinator.Updates(t.Context())
			synctest.Wait()

			select {
			case val := <-updates:
				require.True(t, val, "position 0 should emit true")
			default:
				t.Fatal("expected initial value immediately")
			}
		})
	})

	t.Run("emits on position change", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			provider := &mockPositionProvider{}
			coordinator, err := NewEvaluationCoordinator(provider, log.NewNopLogger())
			require.NoError(t, err)

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			updates := coordinator.Updates(ctx)

			// Drain initial value
			<-updates

			// Change position: primary -> secondary
			provider.position.Store(1)

			// Wait for ticker to fire (fake time advances automatically)
			time.Sleep(checkInterval)
			synctest.Wait()

			select {
			case val := <-updates:
				require.False(t, val, "position 1 should emit false")
			default:
				t.Fatal("expected update after position change")
			}
		})
	})

	t.Run("closes channel on context cancellation", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			provider := &mockPositionProvider{}
			coordinator, err := NewEvaluationCoordinator(provider, log.NewNopLogger())
			require.NoError(t, err)

			ctx, cancel := context.WithCancel(t.Context())
			updates := coordinator.Updates(ctx)

			// Drain initial value
			<-updates

			cancel()
			synctest.Wait()

			select {
			case _, ok := <-updates:
				require.False(t, ok, "channel should be closed")
			default:
				t.Fatal("channel should close on context cancellation")
			}
		})
	})
}
