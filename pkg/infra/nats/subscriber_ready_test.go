package nats

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSubscriptionWaitReady(t *testing.T) {
	for _, tc := range []struct {
		name string
		opts []SubscribeOption
	}{
		{name: "plain"},
		{name: "reconnect", opts: []SubscribeOption{WithOnReconnect(func() {})}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("acknowledges capture before first publish", func(t *testing.T) {
				srv := startTestServer(t)
				pub := newTestPublisher(t, srv)
				subscriber := newTestSubscriber(t, srv)
				received := make(chan []byte, 1)
				sub, err := subscriber.Subscribe(t.Context(), "grafana.ready", func(_ string, data []byte) { received <- data }, tc.opts...)
				require.NoError(t, err)
				ctx, cancel := context.WithTimeout(t.Context(), time.Second)
				defer cancel()
				require.NoError(t, sub.WaitReady(ctx))
				require.NoError(t, pub.Publish(ctx, "grafana.ready", []byte("first")))
				select {
				case data := <-received:
					require.Equal(t, "first", string(data))
				case <-ctx.Done():
					t.Fatal("subscription acknowledged without establishing capture")
				}
			})

			t.Run("local subscription is not readiness", func(t *testing.T) {
				cfg := setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{"nats://127.0.0.1:1"}}
				subscriber := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), newConfig(cfg, nil))
				t.Cleanup(subscriber.close)
				sub, err := subscriber.Subscribe(t.Context(), "grafana.ready", func(string, []byte) {}, tc.opts...)
				require.NoError(t, err)
				ctx, cancel := context.WithTimeout(t.Context(), 10*time.Millisecond)
				defer cancel()
				require.ErrorIs(t, sub.WaitReady(ctx), context.DeadlineExceeded)
			})
		})
	}
}
