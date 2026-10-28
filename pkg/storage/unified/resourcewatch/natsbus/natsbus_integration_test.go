package natsbus_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/resourcebus"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch/natsbus"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvr = schema.GroupVersionResource{Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "repositories"}

// TestIntegrationEmbeddedServer drives the adapter against a real embedded NATS server, so that the subject it
// composes and the payload it decodes are proven against the publisher rather than against a fake.
func TestIntegrationEmbeddedServer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("a published notification is delivered as a bus event", func(t *testing.T) {
		ctx, pub, sub := startNats(t)
		events := make(chan resourcebus.Event, 64)
		subscription, err := natsbus.New(sub, log.NewNopLogger()).Subscribe(ctx, gvr, "default",
			func(_ context.Context, evt resourcebus.Event) { events <- evt })
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, subscription.Close()) })
		require.NoError(t, subscription.WaitReady(waitCtx(t, ctx)))

		publish(t, ctx, pub, "default", &resourcepb.WatchNotification{
			Type: resourcepb.WatchNotification_MODIFIED, Namespace: "default", Name: "repo-1", ResourceVersion: 42,
		})

		select {
		case got := <-events:
			require.Equal(t, resourcebus.Event{
				Verb: resourcebus.VerbModified, Namespace: "default", Name: "repo-1", ResourceVersion: "42",
			}, got)
		case <-time.After(5 * time.Second):
			t.Fatal("no event delivered")
		}
	})

	t.Run("a shared group delivers each event to exactly one subscriber", func(t *testing.T) {
		ctx, pub, sub := startNats(t)
		bus := natsbus.New(sub, log.NewNopLogger())

		var first, second atomic.Int64
		for _, count := range []*atomic.Int64{&first, &second} {
			subscription, err := bus.Subscribe(ctx, gvr, "default",
				func(context.Context, resourcebus.Event) { count.Add(1) },
				resourcebus.WithGroup(resourcebus.Group{Name: "repo-controller", Delivery: resourcebus.GroupDeliveryRoundRobin}))
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, subscription.Close()) })
			require.NoError(t, subscription.WaitReady(waitCtx(t, ctx)))
		}

		const published = 20
		for range published {
			publish(t, ctx, pub, "default", &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_ADDED, Namespace: "default", Name: "repo-1", ResourceVersion: 1,
			})
		}

		require.Eventually(t, func() bool {
			return first.Load()+second.Load() == published
		}, 5*time.Second, 10*time.Millisecond, "group received %d of %d events", first.Load()+second.Load(), published)
		// Hold briefly: a second copy of any event would arrive here, and the totals must stay at one each.
		time.Sleep(100 * time.Millisecond)
		require.Equal(t, int64(published), first.Load()+second.Load())
	})
}

// waitCtx is a deadline for WaitReady, which never returns without one.
func waitCtx(t *testing.T, ctx context.Context) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func startNats(t *testing.T) (context.Context, *nats.PublisherService, *nats.SubscriberService) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:       true,
		Mode:          setting.NATSModeEmbedded,
		ListenAddress: "127.0.0.1",
		ClientPort:    natsserver.RANDOM_PORT,
		ClusterPort:   natsserver.RANDOM_PORT,
	}

	server, err := nats.ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	start(t, ctx, server)

	natsCfg := nats.ProvideNATSConfig(cfg, server)
	pub := nats.ProvidePublisher(natsCfg, prometheus.NewRegistry())
	sub := nats.ProvideSubscriber(natsCfg, prometheus.NewRegistry())
	start(t, ctx, pub)
	start(t, ctx, sub)

	return ctx, pub, sub
}

func start(t *testing.T, ctx context.Context, svc services.Service) {
	t.Helper()
	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.Background())
	})
}

func publish(t *testing.T, ctx context.Context, pub *nats.PublisherService, namespace string, notification *resourcepb.WatchNotification) {
	t.Helper()
	data, err := proto.Marshal(notification)
	require.NoError(t, err)
	require.NoError(t, pub.Publish(ctx, resourcewatch.Subject(gvr, namespace), data))
}
