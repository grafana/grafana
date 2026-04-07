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

// QueryCacheConfigsTestCase tests the "querycacheconfigs" ResourceMigration.
type QueryCacheConfigsTestCase struct {
	names []string
}

func (tc *QueryCacheConfigsTestCase) Name() string { return "querycacheconfigs" }

func (tc *QueryCacheConfigsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{{
		Group:    "querycaching.grafana.app",
		Version:  "v1beta1",
		Resource: "querycacheconfigs",
	}}
}

func (tc *QueryCacheConfigsTestCase) FeatureToggles() []string {
	return []string{featuremgmt.FlagKubernetesQueryCaching}
}

func (tc *QueryCacheConfigsTestCase) RenameTables() []string {
	return []string{"data_source_cache"}
}

func (tc *QueryCacheConfigsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// data_source_cache table is created by the standard database migrations (snapshot)
}

func (tc *QueryCacheConfigsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	engine := helper.GetEnv().SQLStore.GetEngine()
	orgID := helper.Org1.OrgID

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

	return false // K8s API requires enterprise license, not available in Mode0
}

func (tc *QueryCacheConfigsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "querycaching.grafana.app",
			Version:  "v1beta1",
			Resource: "querycacheconfigs",
		},
	})

	// The querycaching API requires an enterprise license to register.
	// When the API isn't available, List returns "not found" — acceptable
	// when we don't expect data to exist.
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
