package server

import (
	"context"
	"sync"
	"testing"

	"github.com/dgraph-io/badger/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// A pre-dialed KV (unified-kv-grpc) used to arrive as a fully built backend,
// which skipped this constructor and with it the bus wiring, so the storage-api
// never subscribed.
func TestInitUnifiedBackendModuleKVGrpc(t *testing.T) {
	subscriber := &recordingSubscriber{}
	s := &ModuleServer{
		cfg:            kvGrpcCfg(t),
		kvStore:        moduleTestKV(t),
		registerer:     prometheus.NewRegistry(),
		natsSubscriber: subscriber,
	}

	_, err := s.initUnifiedBackendModule(false)()
	require.NoError(t, err)
	require.NotNil(t, s.storageBackend)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	_, err = s.storageBackend.WatchWriteEvents(ctx)
	require.NoError(t, err)

	require.Equal(t, 1, subscriber.subscriptions())
}

func kvGrpcCfg(t *testing.T) *setting.Cfg {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").
		SetValue(string(options.StorageTypeUnifiedKVGrpc))
	cfg.NATS.Notifier = true
	return cfg
}

func moduleTestKV(t *testing.T) resource.KV {
	t.Helper()

	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	return resource.NewBadgerKV(db)
}

type recordingSubscriber struct {
	mu    sync.Mutex
	count int
}

func (r *recordingSubscriber) Enabled() bool { return true }

func (r *recordingSubscriber) Subscribe(_ context.Context, _ string, _ nats.MessageHandler, _ ...nats.SubscribeOption) (nats.Subscription, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.count++
	return &noopSubscription{}, nil
}

func (r *recordingSubscriber) subscriptions() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count
}

type noopSubscription struct{}

func (*noopSubscription) Unsubscribe() error { return nil }
