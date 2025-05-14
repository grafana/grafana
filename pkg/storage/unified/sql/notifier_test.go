package sql

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
)

func TestChannelNotifier(t *testing.T) {
	t.Run("should notify subscribers of events", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		n := newChannelNotifier(5, &logging.NoOpLogger{})

		events, err := n.notify(ctx)
		require.NoError(t, err)

		testEvent := &resource.WrittenEvent{
			Type: resource.WatchEvent_ADDED,
			Key: &resource.ResourceKey{
				Group:     "test",
				Resource:  "test",
				Name:      "test1",
				Namespace: "test",
			},
			ResourceVersion: 1,
		}
		n.send(ctx, testEvent)

		select {
		case event := <-events:
			require.Equal(t, testEvent, event)
		case <-ctx.Done():
			t.Fatal("timeout waiting for event")
		}
	})

	t.Run("should drop events when buffer is full", func(t *testing.T) {
		bufferSize := 2
		n := newChannelNotifier(bufferSize, &logging.NoOpLogger{})

		events, err := n.notify(context.Background())
		require.NoError(t, err)

		for i := 0; i < bufferSize+1; i++ {
			n.send(context.Background(), &resource.WrittenEvent{
				ResourceVersion: int64(i),
			})
		}

		require.Equal(t, bufferSize, len(events))
	})

	t.Run("should close subscriber channels when context cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		n := newChannelNotifier(5, &logging.NoOpLogger{})

		events, err := n.notify(ctx)
		require.NoError(t, err)

		cancel()

		_, ok := <-events
		require.False(t, ok, "channel should be closed")
	})
}
