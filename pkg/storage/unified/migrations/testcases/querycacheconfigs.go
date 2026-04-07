package testcases

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// queryCacheConfigsTestCase tests the "querycacheconfigs" ResourceMigration
type queryCacheConfigsTestCase struct {
	// names stores the expected K8s resource names (pluginId.datasourceUid)
	names []string
}

// NewQueryCacheConfigsTestCase creates a test case for the querycacheconfigs migrator
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
	// data_source_cache table is created by the standard database migrations (snapshot)
}

func (tc *queryCacheConfigsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	env := helper.GetEnv()
	engine := env.SQLStore.GetEngine()
	orgID := helper.Org1.OrgID

	// Insert test datasources into the data_source table so the join works.
	// The data_source table already exists from the default migrations.
	_, err := engine.Exec(
		"INSERT INTO data_source (org_id, version, type, name, access, url, uid, created, updated) VALUES (?, 1, 'prometheus', 'Prometheus', 'proxy', 'http://localhost:9090', 'ds-prom-uid', '2024-01-01 00:00:00', '2024-01-01 00:00:00')",
		orgID,
	)
	require.NoError(t, err)

	_, err = engine.Exec(
		"INSERT INTO data_source (org_id, version, type, name, access, url, uid, created, updated) VALUES (?, 1, 'loki', 'Loki', 'proxy', 'http://localhost:3100', 'ds-loki-uid', '2024-01-01 00:00:00', '2024-01-01 00:00:00')",
		orgID,
	)
	require.NoError(t, err)

	// Insert cache configs using subquery to get the data_source_id
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

	return false // Mode0 is NOT supported (no legacy K8s API in OSS)
}

func (tc *queryCacheConfigsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "querycaching.grafana.app",
			Version:  "v1beta1",
			Resource: "querycacheconfigs",
		},
	})

	// The querycaching API group requires an enterprise license to register.
	// If the API isn't available, a List returns "not found". When we don't
	// expect data to exist, that's an acceptable outcome.
	_, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	if err != nil && !shouldExist && k8serrors.IsNotFound(err) {
		return
	}
	require.NoError(t, err)

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.names)
	}

	verifyResourceCount(t, client, expectedCount)
	for _, name := range tc.names {
		verifyResource(t, client, name, shouldExist)
	}
}
