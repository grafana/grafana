package service

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	resource "github.com/grafana/grafana/pkg/storage/unified/resource"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// natsSubscriberAdapter bridges nats.Subscriber to the EventSubscriber interface
// natsNotifier consumes, mirroring the production wiring.
type natsSubscriberAdapter struct{ sub nats.Subscriber }

func (a natsSubscriberAdapter) Enabled() bool { return a.sub.Enabled() }

func (a natsSubscriberAdapter) Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte), onReconnect func()) (resource.Subscription, error) {
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
	backend := setupTestStorageBackend(t, func(o *resource.KVBackendOptions) {
		o.EventPublisher = pub
		o.EventSubscriber = natsSubscriberAdapter{sub: sub}
		o.EnableNatsNotifier = true
	})
	idx := &MockResourceIndex{}
	search := &mockSearchBackend{cache: map[resourcecontract.NamespacedResource]searchmodel.ResourceIndex{resourcecontract.GlobalSearchKey("default"): idx}}
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

	dashboards := resourcecontract.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
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
		_, err = backend.WriteEvent(ctx, resource.WriteEvent{
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
	assert.Equal(t, searchmodel.ActionIndex, item.Action)
	require.NotNil(t, item.Doc)
	assert.Equal(t, "default", item.Doc.Key.Namespace)
	assert.Equal(t, "dashboard.grafana.app", item.Doc.Key.Group)
	assert.Equal(t, "dashboards", item.Doc.Key.Resource)
	assert.True(t, written[item.Doc.Key.Name], "not a dashboard this test wrote: %s", item.Doc.Key.Name)
	assert.Equal(t, titleOf(item.Doc.Key.Name), item.Doc.Title)
}

// noWatchStream is a KV backend whose watch stream fails, so a test can tell the
// NATS path from the fallback.
type noWatchStream struct{ resource.StorageBackend }

func (noWatchStream) WatchWriteEvents(context.Context) (<-chan *resource.WrittenEvent, error) {
	return nil, errors.New("the watch stream is not used here")
}

func createTestObjectWithName(name string, ns resourcecontract.NamespacedResource, value string) (*unstructured.Unstructured, error) {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": ns.Group + "/v1", "kind": ns.Resource,
		"metadata": map[string]any{"name": name, "namespace": ns.Namespace},
		"spec":     map[string]any{"value": value},
	}}, nil
}
