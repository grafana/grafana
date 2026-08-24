package unified

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestNatsStorageBackendOptions(t *testing.T) {
	publisher := &fakePublisher{}
	subscriber := &fakeSubscriber{}

	tests := []struct {
		name           string
		notifier       bool
		notifierShadow bool
		publisher      nats.Publisher
		subscriber     nats.Subscriber
		wantPublisher  bool
		wantSubscriber bool
		wantNotifier   bool
		wantShadow     bool
	}{
		{
			name:          "publishes without consuming by default",
			publisher:     publisher,
			subscriber:    subscriber,
			wantPublisher: true,
		},
		{
			name:           "feeds the watch pipeline from the bus",
			notifier:       true,
			publisher:      publisher,
			subscriber:     subscriber,
			wantPublisher:  true,
			wantSubscriber: true,
			wantNotifier:   true,
		},
		{
			name:           "runs the shadow notifier",
			notifierShadow: true,
			publisher:      publisher,
			subscriber:     subscriber,
			wantPublisher:  true,
			wantSubscriber: true,
			wantShadow:     true,
		},
		{
			name:          "notifier without a subscriber stays on polling",
			notifier:      true,
			publisher:     publisher,
			wantPublisher: true,
		},
		{
			name:           "consumes without a publisher",
			notifier:       true,
			subscriber:     subscriber,
			wantSubscriber: true,
			wantNotifier:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.NATS.Notifier = tt.notifier
			cfg.NATS.NotifierShadow = tt.notifierShadow

			var backendOpts resource.KVBackendOptions
			for _, opt := range NatsStorageBackendOptions(cfg, tt.publisher, tt.subscriber) {
				opt(&backendOpts)
			}

			require.Equal(t, tt.wantPublisher, backendOpts.EventPublisher != nil)
			require.Equal(t, tt.wantSubscriber, backendOpts.EventSubscriber != nil)
			require.Equal(t, tt.wantNotifier, backendOpts.EnableNatsNotifier)
			require.Equal(t, tt.wantShadow, backendOpts.EnableNatsNotifierShadow)
		})
	}
}

type fakePublisher struct{}

func (*fakePublisher) Enabled() bool { return true }

func (*fakePublisher) Publish(_ context.Context, _ string, _ []byte) error { return nil }

type fakeSubscriber struct{}

func (*fakeSubscriber) Enabled() bool { return true }

func (*fakeSubscriber) Subscribe(_ context.Context, _ string, _ nats.MessageHandler, _ ...nats.SubscribeOption) (nats.Subscription, error) {
	return nil, nil
}
