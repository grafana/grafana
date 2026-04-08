package testcases

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

type queryCacheConfigsTestCase struct {
	names []string
}

func NewQueryCacheConfigsTestCase() ResourceMigratorTestCase {
	return &queryCacheConfigsTestCase{
		names: []string{},
	}
}

func (tc *queryCacheConfigsTestCase) Name() string {
	return "querycacheconfigs"
}

func (tc *queryCacheConfigsTestCase) FeatureToggles() []string {
	return []string{featuremgmt.FlagKubernetesQueryCaching}
}

func (tc *queryCacheConfigsTestCase) RenameTables() []string {
	return []string{"data_source_cache"}
}

func (tc *queryCacheConfigsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "querycaching.grafana.app",
			Version:  "v1beta1",
			Resource: "querycacheconfigs",
		},
	}
}

func (tc *queryCacheConfigsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// data_source_cache is still created by enterprise migrations (caching.AddMigration).
	// When data_source_cache is decommissioned after full migration, add caching.AddMigration(mg) here.
}

func (tc *queryCacheConfigsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	engine := helper.GetEnv().SQLStore.GetEngine()
	orgID := helper.Org1.OrgID

	_, err := engine.Exec(
		"INSERT INTO data_source (org_id, version, type, name, access, url, uid, basic_auth, is_default, json_data, created, updated) VALUES (?, 1, 'prometheus', 'Prometheus', 'proxy', 'http://localhost:9090', 'ds-prom-uid', 0, 0, '{}', '2024-01-01 00:00:00', '2024-01-01 00:00:00')",
		orgID,
	)
	require.NoError(t, err)

	_, err = engine.Exec(
		"INSERT INTO data_source (org_id, version, type, name, access, url, uid, basic_auth, is_default, json_data, created, updated) VALUES (?, 1, 'loki', 'Loki', 'proxy', 'http://localhost:3100', 'ds-loki-uid', 0, 0, '{}', '2024-01-01 00:00:00', '2024-01-01 00:00:00')",
		orgID,
	)
	require.NoError(t, err)

	_, err = engine.Exec(
		"INSERT INTO data_source_cache (data_source_id, data_source_uid, enabled, ttl_ms, ttl_resources_ms, use_default_ttl, created, updated) SELECT id, uid, 1, 60000, 300000, 0, '2024-01-01 00:00:00', '2024-01-02 00:00:00' FROM data_source WHERE uid = 'ds-prom-uid'",
	)
	require.NoError(t, err)
	tc.names = append(tc.names, "prometheus.ds-prom-uid")

	_, err = engine.Exec(
		"INSERT INTO data_source_cache (data_source_id, data_source_uid, enabled, ttl_ms, ttl_resources_ms, use_default_ttl, created, updated) SELECT id, uid, 0, 30000, 120000, 1, '2024-01-01 00:00:00', '2024-01-02 00:00:00' FROM data_source WHERE uid = 'ds-loki-uid'",
	)
	require.NoError(t, err)
	tc.names = append(tc.names, "loki.ds-loki-uid")

	return false // K8s API not available without enterprise license
}

func (tc *queryCacheConfigsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	// K8s API requires enterprise license; verify via resource table directly.
	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	engine := helper.GetEnv().SQLStore.GetEngine()

	rows, err := engine.DB().Query(
		"SELECT COUNT(*) FROM resource WHERE namespace = ? AND resource = ?",
		namespace, "querycacheconfigs",
	)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()

	var count int
	require.True(t, rows.Next())
	require.NoError(t, rows.Scan(&count))
	require.NoError(t, rows.Err())

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.names)
	}
	require.Equal(t, expectedCount, count, "expected %d querycacheconfig resources in namespace %s", expectedCount, namespace)
}
