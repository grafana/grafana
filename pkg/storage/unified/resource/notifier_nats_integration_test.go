package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net"
	"sync/atomic"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/peer"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
		backend := newTestKVStorageBackend(pub)
		expiry := NewWatchExpiry()
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, expiry, nil, &logging.NoOpLogger{})
		out := notifier.Watch(ctx, WatchOptions{})

		event := Event{
			Namespace:       "default",
			Group:           "provisioning.grafana.app",
			Resource:        "repositories",
			Name:            "repo-1",
			ResourceVersion: 42,
			Action:          DataActionUpdated,
			Folder:          "folder-1",
			PreviousRV:      41,
			PreviousAction:  DataActionCreated,
			PreviousFolder:  "old-folder",
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

		assert.Equal(t, event, got)
	})

	t.Run("every action type survives the marshal/transport/unmarshal round trip", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := newTestKVStorageBackend(pub)
		expiry := NewWatchExpiry()
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, expiry, nil, &logging.NoOpLogger{})
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
				PreviousRV:      1,
				PreviousAction:  action,
			})
			// Watch subscribes to the whole change stream, so a late warm-up
			// duplicate (establishInterest publishes many and drains only on a
			// timeout) can still be queued ahead of ours. Skip anything that is not
			// the playlist event we just published.
			var got Event
			for {
				got = recvEvent(t, out)
				if got.Namespace == "default" {
					break
				}
			}
			assert.Equal(t, action, got.Action, "action %q must survive the round trip", action)
			assert.Equal(t, action, got.PreviousAction)
			assert.Empty(t, got.PreviousFolder)
		}
	})

	t.Run("publisher targets the resource-specific subject a per-resource consumer subscribes to", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := newTestKVStorageBackend(pub)

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
				require.Equal(t, "us.watch.v1.provisioning.grafana.app.default.repositories", subj)
				return true
			case <-time.After(20 * time.Millisecond):
				return false
			}
		}, 5*time.Second, time.Millisecond)
	})

	t.Run("malformed and unknown-type notifications are dropped, not delivered", func(t *testing.T) {
		ctx, pub, sub := startNatsRoundTrip(t)
		backend := newTestKVStorageBackend(pub)
		dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "nats_notifier_dropped_total"}, []string{"reason"})
		expiry := NewWatchExpiry()
		notifier := newNatsNotifier(natsSubscriberAdapter{sub: sub}, expiry, dropped, &logging.NoOpLogger{})
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

func (a natsSubscriberAdapter) Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte), onReconnect func()) (Subscription, error) {
	return a.sub.Subscribe(ctx, subject, nats.MessageHandler(handler), nats.WithOnReconnect(onReconnect))
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
		ClientPort:    natsserver.RANDOM_PORT,
		ClusterPort:   natsserver.RANDOM_PORT,
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

// A real write to the KV backend reaches the global index the whole way: NATS
// publishes it, the search server's watch receives the key through a real
// subscription, re-reads the object from the same KV, and writes it to the
// index. The index is the test double, because the Bleve index lives in a
// package that imports this one.
func TestIntegrationGlobalIndexFollowsKVWritesThroughNATS(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx, pub, sub := startNatsRoundTrip(t)
	backend := setupTestStorageBackend(t, func(o *KVBackendOptions) {
		o.EventPublisher = pub
		o.EventSubscriber = natsSubscriberAdapter{sub: sub}
		o.EnableNatsNotifier = true
	})
	idx := &MockResourceIndex{}
	search := &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("default"): idx}}
	// Without the watch stream, so the keys can only have come through NATS.
	server := globalTestServer(t, noWatchStream{backend}, search)

	watchCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		server.runGlobalIndexWatch(watchCtx)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})

	dashboards := NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	titleOf := func(name string) string { return "Title of " + name }
	written := map[string]bool{}
	writeDashboard := func() error {
		name := fmt.Sprintf("dash-%d", len(written)+1)
		written[name] = true
		obj, err := createTestObjectWithName(name, dashboards, "value")
		if err != nil {
			return err
		}
		if err := unstructured.SetNestedField(obj.Object, titleOf(name), "spec", "title"); err != nil {
			return err
		}
		value, err := obj.MarshalJSON()
		if err != nil {
			return err
		}
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return err
		}
		_, err = backend.WriteEvent(ctx, WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Namespace: dashboards.Namespace, Group: dashboards.Group, Resource: dashboards.Resource, Name: name},
			Value:  value,
			Object: meta,
		})
		return err
	}
	// Interest propagates asynchronously, and core NATS drops a message nobody
	// is subscribed to yet, so keep writing new dashboards until one arrives. A
	// failed write ends the wait, so it is reported as itself below rather than
	// as a timeout.
	var writeErr error
	require.Eventually(t, func() bool {
		if writeErr = writeDashboard(); writeErr != nil {
			return true
		}
		return len(idx.indexedItems()) > 0
	}, 10*time.Second, 100*time.Millisecond)
	require.NoError(t, writeErr)

	// Whichever write arrived first, it is one this test made, read back from
	// storage with its contents.
	item := idx.indexedItems()[0]
	assert.Equal(t, ActionIndex, item.Action)
	require.NotNil(t, item.Doc)
	assert.Equal(t, "default", item.Doc.Key.Namespace)
	assert.Equal(t, "dashboard.grafana.app", item.Doc.Key.Group)
	assert.Equal(t, "dashboards", item.Doc.Key.Resource)
	assert.True(t, written[item.Doc.Key.Name], "not a dashboard this test wrote: %s", item.Doc.Key.Name)
	assert.Equal(t, titleOf(item.Doc.Key.Name), item.Doc.Title)
}

// noWatchStream is a KV backend whose watch stream fails, so a test can tell the
// NATS path from the fallback.
type noWatchStream struct{ *kvStorageBackend }

func (noWatchStream) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return nil, errors.New("the watch stream is not used here")
}

// stallingKV blocks BatchGet while stalled, like a store too slow to read
// notified values back under load.
type stallingKV struct {
	KV
	stalled atomic.Bool
	release chan struct{}
}

func (s *stallingKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	if s.stalled.Load() {
		select {
		case <-s.release:
		case <-ctx.Done():
		}
	}
	return s.KV.BatchGet(ctx, section, keys)
}

// A notification dropped by a full notifier buffer is missed by every watch, so
// the watch must expire and the client's re-list must recover the write.
func TestIntegrationNatsWatchExpiresWhenNotifierDrops(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	_, pub, sub := startNatsRoundTrip(t)
	store := &stallingKV{release: make(chan struct{})}
	srv := newWatchTestServer(t, watchTestServerOpts{
		EventSubscriber:    natsSubscriberAdapter{sub: sub},
		EventPublisher:     pub,
		NotifierBufferSize: 1,
		WrapKV: func(kv KV) KV {
			store.KV = kv
			return store
		},
	})
	ctx := authlib.WithAuthInfo(t.Context(), newWatchTestUser())
	req := &resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
		Group: watchTestGroup, Resource: watchTestResource, Namespace: watchTestNamespace,
	}}, SendInitialEvents: true, AllowWatchBookmarks: true}

	require.NoError(t, createTestPlaylist(ctx, srv))
	watch, done := startNatsRecoveryWatch(t, ctx, srv, req)
	requireNatsRecoveryEvent(t, watch, resourcepb.WatchEvent_BOOKMARK)
	require.NoError(t, createTestPlaylist(ctx, srv))
	requireNatsRecoveryEvent(t, watch, resourcepb.WatchEvent_ADDED)
	created := 2

	// Notifications back up behind the stalled read until the buffer drops one.
	store.stalled.Store(true)
	var watchErr error
	require.Eventually(t, func() bool {
		require.NoError(t, createTestPlaylist(ctx, srv))
		created++
		select {
		case watchErr = <-done:
			return true
		default:
			return false
		}
	}, 10*time.Second, 20*time.Millisecond, "watch did not expire after the notifier dropped a notification")
	require.True(t, IsResourceVersionExpired(watchErr), "expected ResourceExpired, got %v", watchErr)
	store.stalled.Store(false)
	close(store.release)

	count := 0
	_, err := srv.backend.ListIterator(ctx, &resourcepb.ListRequest{Options: req.Options}, func(iter ListIterator) error {
		for iter.Next() {
			count++
		}
		return iter.Error()
	})
	require.NoError(t, err)
	require.Equal(t, created, count, "relist must recover the writes whose notifications were dropped")
}

// Clients reconnect watches more often than the max age, so expiry must follow
// each client's phase across reconnects rather than restart with every watch.
func TestIntegrationNatsWatchMaxAgeFollowsClientPhase(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const maxAge = 2 * time.Second
	_, pub, sub := startNatsRoundTrip(t)
	srv := newWatchTestServer(t, watchTestServerOpts{
		EventSubscriber: natsSubscriberAdapter{sub: sub},
		EventPublisher:  pub,
		NatsWatchMaxAge: maxAge,
	})
	key := &resourcepb.ResourceKey{Group: watchTestGroup, Resource: watchTestResource, Namespace: watchTestNamespace}
	req := &resourcepb.WatchRequest{Options: &resourcepb.ListOptions{Key: key}}
	controller := func(uid string) authlib.AuthInfo {
		u := newWatchTestUser()
		u.UserUID = uid
		return u
	}

	// Every reconnect is relayed by another apiserver replica, with a new port.
	clients := []struct {
		name string
		user authlib.AuthInfo
	}{
		{"controller a", controller("a")},
		{"controller b", controller("b")},
		{"service caller", &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "apiserver"}},
	}
	for _, c := range clients {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			clientCtx := func(n int) context.Context {
				return peer.NewContext(authlib.WithAuthInfo(t.Context(), c.user),
					&peer.Peer{Addr: &net.TCPAddr{IP: net.ParseIP(fmt.Sprintf("10.0.0.%d", n%250+1)), Port: 40000 + n}})
			}
			phase := watchMaxAgePhase(c.user, key, maxAge)

			// Each reconnect lasts a fifth of the max age.
			deadline := time.Now().Add(2*maxAge + time.Second)
			for n := 0; time.Now().Before(deadline); n++ {
				watchCtx, cancel := context.WithTimeout(clientCtx(n), maxAge/5)
				err := srv.Watch(req, newMockWatchServer(watchCtx))
				expiredAt := time.Now()
				cancel()
				if err == nil {
					continue
				}
				require.True(t, IsResourceVersionExpired(err), "expected ResourceExpired, got %v", err)
				offset := (time.Duration(expiredAt.UnixNano())%maxAge - phase + maxAge) % maxAge
				require.Less(t, offset, 200*time.Millisecond, "expired %v after the client's phase", offset)
				return
			}
			t.Fatal("reconnecting watch never expired")
		})
	}
}
