package resource

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationNatsWatchNotificationRoundTrip drives the real publish
// (kvStorageBackend) and consume (natsNotifier) sides against an embedded NATS
// server, proving they agree over the wire rather than against a fake.
func TestIntegrationNatsWatchNotificationRoundTrip(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("committed write round-trips through NATS with every field intact", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, nil, log.NewNopLogger())
		out := notifier.Watch(ctx, WatchOptions{})

		event := Event{
			Namespace:       "default",
			Group:           "provisioning.grafana.app",
			Resource:        "repositories",
			Name:            "repo-1",
			ResourceVersion: 42,
			Action:          DataActionUpdated,
			Folder:          "folder-1",
		}

		// Interest propagates asynchronously; core NATS drops messages with no
		// interest, so re-publish until one lands.
		var got Event
		require.Eventually(t, func() bool {
			backend.publishWatchNotification(ctx, event)
			select {
			case got = <-out:
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)

		assert.Equal(t, event.Group, got.Group)
		assert.Equal(t, event.Resource, got.Resource)
		assert.Equal(t, event.Namespace, got.Namespace)
		assert.Equal(t, event.Name, got.Name)
		assert.Equal(t, event.ResourceVersion, got.ResourceVersion)
		assert.Equal(t, event.Folder, got.Folder)
		assert.Equal(t, DataActionUpdated, got.Action)
		// WatchNotification carries no previous RV.
		assert.Equal(t, int64(0), got.PreviousRV)
	})

	t.Run("every action type survives the marshal/transport/unmarshal round trip", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, nil, log.NewNopLogger())
		out := notifier.Watch(ctx, WatchOptions{})

		establishInterest(t, ctx, out, backend)

		// Guards the publish and consume switches (in separate files) staying in sync.
		for _, action := range []kv.DataAction{DataActionCreated, DataActionUpdated, DataActionDeleted} {
			backend.publishWatchNotification(ctx, Event{
				Namespace:       "default",
				Group:           "playlist.grafana.app",
				Resource:        "playlists",
				Name:            "p-1",
				ResourceVersion: 1,
				Action:          action,
			})
			got := recvEvent(t, out)
			assert.Equal(t, action, got.Action, "action %q must survive the round trip", action)
		}
	})

	t.Run("publisher targets the resource-specific subject a per-resource consumer subscribes to", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}

		const namespace = "default"
		gvr := schema.GroupVersionResource{Group: "provisioning.grafana.app", Resource: "repositories"}
		subject := resourcewatch.Subject(gvr, namespace)

		got := make(chan string, 16)
		_, err := sub.Subscribe(ctx, subject, func(subj string, _ []byte) {
			select {
			case got <- subj:
			default:
			}
		})
		require.NoError(t, err)

		event := Event{
			Namespace:       namespace,
			Group:           gvr.Group,
			Resource:        gvr.Resource,
			Name:            "repo-1",
			ResourceVersion: 7,
			Action:          DataActionCreated,
		}

		require.Eventually(t, func() bool {
			backend.publishWatchNotification(ctx, event)
			select {
			case subj := <-got:
				require.Equal(t, subject, subj)
				require.Equal(t, "provisioning.grafana.app.default.repositories", subj)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("malformed and unknown-type notifications are dropped, not delivered", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}
		dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "nats_notifier_dropped_total"}, []string{"reason"})
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, dropped, log.NewNopLogger())
		out := notifier.Watch(ctx, WatchOptions{})

		// Interest must be live first, else NATS drops the bad messages before the
		// handler runs and the drop counters never move.
		establishInterest(t, ctx, out, backend)

		subject := resourcewatch.Subject(schema.GroupVersionResource{Group: "playlist.grafana.app", Resource: "playlists"}, "default")

		// Garbage bytes fail proto.Unmarshal; UNKNOWN type maps to no action.
		require.NoError(t, pub.Publish(ctx, subject, []byte("not a valid protobuf")))
		require.NoError(t, pub.Publish(ctx, subject, mustMarshalNotification(t, &resourcepb.WatchNotification{
			Type:            resourcepb.WatchNotification_UNKNOWN,
			Group:           "playlist.grafana.app",
			Resource:        "playlists",
			Namespace:       "default",
			ResourceVersion: 1,
		})))

		require.Eventually(t, func() bool {
			return promtestutil.ToFloat64(dropped.WithLabelValues("unmarshal_error")) == 1 &&
				promtestutil.ToFloat64(dropped.WithLabelValues("unknown_type")) == 1
		}, 5*time.Second, 10*time.Millisecond)

		expectNoEvent(t, out)
	})
}

// natsSubscriberAdapter bridges nats.Subscriber to the EventSubscriber interface
// natsNotifier consumes, mirroring the production wiring.
type natsSubscriberAdapter struct{ sub nats.Subscriber }

func (a natsSubscriberAdapter) Enabled() bool { return a.sub.Enabled() }

func (a natsSubscriberAdapter) Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte)) (Subscription, error) {
	return a.sub.Subscribe(ctx, subject, nats.MessageHandler(handler))
}

// startNatsRoundTrip boots an embedded NATS server plus a real publisher and
// subscriber, returning a context cancelled at test end.
func startNatsRoundTrip(t *testing.T) (context.Context, *nats.PublisherService, *nats.SubscriberService) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:       true,
		Mode:          setting.NATSModeEmbedded,
		ListenAddress: "127.0.0.1",
		// Free ports avoid collisions; a zero ClusterPort leaves ClusterAddr() nil,
		// which the server dereferences.
		ClientPort:  freePort(t),
		ClusterPort: freePort(t),
	}

	server, err := nats.ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	startNatsService(t, ctx, server)

	natsCfg := nats.ProvideNATSConfig(cfg, server)
	pub := nats.ProvidePublisher(natsCfg, prometheus.NewRegistry())
	sub := nats.ProvideSubscriber(natsCfg, prometheus.NewRegistry())
	startNatsService(t, ctx, pub)
	startNatsService(t, ctx, sub)

	return ctx, pub, sub
}

// establishInterest re-publishes until a warm-up notification is delivered
// (confirming the subscription's interest has propagated), then drains the
// duplicates so the caller starts from an empty channel.
func establishInterest(t *testing.T, ctx context.Context, out <-chan Event, backend *kvStorageBackend) {
	t.Helper()
	warmup := Event{
		Namespace:       "warmup",
		Group:           "warmup.grafana.app",
		Resource:        "warmups",
		Name:            "w",
		ResourceVersion: 1,
		Action:          DataActionCreated,
	}
	require.Eventually(t, func() bool {
		backend.publishWatchNotification(ctx, warmup)
		select {
		case <-out:
			return true
		case <-time.After(20 * time.Millisecond):
			return false
		}
	}, 5*time.Second, time.Millisecond)

	// Drain warm-up duplicates still in flight.
	for {
		select {
		case <-out:
		case <-time.After(100 * time.Millisecond):
			return
		}
	}
}

func startNatsService(t *testing.T, ctx context.Context, svc services.Service) {
	t.Helper()
	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.Background())
	})
}

func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := l.Addr().(*net.TCPAddr).Port
	require.NoError(t, l.Close())
	return port
}
