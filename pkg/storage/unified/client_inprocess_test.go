package unified

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// The in-process server has to build the snapshot store itself; only the
// standalone server gets one injected.
func TestIntegrationInProcessClientSnapshotStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("KV backend with snapshots enabled", func(t *testing.T) {
		client, err := newInProcessTestClient(t, true, true)
		require.NoError(t, err)
		require.NotNil(t, client)
	})

	t.Run("legacy SQL backend with snapshots enabled fails", func(t *testing.T) {
		_, err := newInProcessTestClient(t, false, true)
		require.ErrorContains(t, err, "index_snapshot_enabled requires a KV-backed storage backend")
	})

	t.Run("legacy SQL backend with snapshots disabled", func(t *testing.T) {
		client, err := newInProcessTestClient(t, false, false)
		require.NoError(t, err)
		require.NotNil(t, client)
	})
}

func newInProcessTestClient(t *testing.T, kvBackend, snapshotsEnabled bool) (resource.ResourceClient, error) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()
	cfg.IndexPath = t.TempDir()
	cfg.EnableSearch = true
	cfg.BuildVersion = "11.5.0"
	cfg.EnableSQLKVBackend = kvBackend
	cfg.IndexSnapshotEnabled = snapshotsEnabled

	eDB, err := sql.ProvideResourceDB(cfg, db.NewTestStore(t))
	require.NoError(t, err)
	kvStore, err := sql.ProvideKV(cfg, eDB)
	require.NoError(t, err)

	reg := prometheus.NewRegistry()
	return newClient(
		options.StorageOptions{StorageType: options.StorageTypeUnified},
		cfg,
		featuremgmt.WithFeatures(),
		tracing.InitializeTracerForTest(),
		reg,
		authlib.FixedAccessClient(true),
		nil, // docs
		resource.ProvideStorageMetrics(reg),
		resource.ProvideIndexMetrics(reg),
		nil, // vectorMetrics
		nil, // secure
		nil, // vectorBackend
		nil, // embedder
		nil, // reranker
		nil, // dashboardStats
		kvStore,
		eDB,
		nil, // gcGate
		nil, // eventPublisher
		nil, // eventSubscriber
		nil, // experimentalKV
		nil, // watchExpiry
	)
}
