package sql

import (
	"context"
	"testing"

	"github.com/dgraph-io/badger/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

// The KV comes over gRPC, so this backend must build without a resource DB.
func TestNewStorageBackendKVGrpc(t *testing.T) {
	t.Run("fails when the kv client is missing", func(t *testing.T) {
		_, err := NewStorageBackend(kvGrpcCfg(), nil, prometheus.NewRegistry(), nil, true, nil, nil)

		require.ErrorContains(t, err, "needs a kv client dialed by the wiring")
	})

	t.Run("builds on the kv alone", func(t *testing.T) {
		kvStore := testKV(t)

		backend, err := NewStorageBackend(kvGrpcCfg(), nil, prometheus.NewRegistry(), nil, true, kvStore, nil)
		require.NoError(t, err)

		kvBackend, ok := backend.(resource.KVBackend)
		require.True(t, ok)
		require.Equal(t, kvStore, kvBackend.KV())
		t.Cleanup(func() { require.NoError(t, kvBackend.Stop(context.Background())) })
	})
}

// The bus options used to be dropped here, leaving the storage-api neither
// publishing nor subscribing.
func TestNewKVGrpcBackendOptions(t *testing.T) {
	subscriber := &fakeEventSubscriber{}
	vectorBackend := &fakeVectorBackend{}
	experimentalKV := &resource.ExperimentalKVOptions{}
	gcGate := resource.NewGCGate()

	opts := newKVGrpcBackendOptions(kvGrpcCfg(), prometheus.NewRegistry(), false, testKV(t), gcGate,
		WithEventPublisher(&fakeEventPublisher{}),
		WithNatsNotifier(subscriber),
		WithVectorBackend(vectorBackend),
		WithExperimentalKV(experimentalKV),
	)

	require.NotNil(t, opts.EventPublisher)
	require.Same(t, subscriber, opts.EventSubscriber)
	require.True(t, opts.EnableNatsNotifier)
	require.Same(t, gcGate, opts.GCGate)
	require.Equal(t, vectorBackend, opts.EmbeddingDeleter)
	require.Same(t, experimentalKV, opts.ExperimentalKV)
}

func TestNewKVGrpcBackendOptionsStorageServices(t *testing.T) {
	cfg := kvGrpcCfg()

	require.True(t, newKVGrpcBackendOptions(cfg, nil, true, nil, nil).DisableStorageServices)
	require.False(t, newKVGrpcBackendOptions(cfg, nil, false, nil, nil).DisableStorageServices)
}

func kvGrpcCfg() *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").
		SetValue(string(options.StorageTypeUnifiedKVGrpc))
	return cfg
}

func testKV(t *testing.T) kv.KV {
	t.Helper()

	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	return resource.NewBadgerKV(db)
}

type fakeEventPublisher struct{}

func (fakeEventPublisher) Enabled() bool { return true }

func (fakeEventPublisher) Publish(_ context.Context, _ string, _ []byte) error { return nil }

type fakeEventSubscriber struct{}

func (*fakeEventSubscriber) Enabled() bool { return true }

func (*fakeEventSubscriber) Subscribe(_ context.Context, _ string, _ func(string, []byte)) (resource.Subscription, error) {
	return nil, nil
}

type fakeVectorBackend struct{ vector.VectorBackend }
