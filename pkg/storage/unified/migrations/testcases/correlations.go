package testcases

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// correlationsTestCase tests the "correlations" ResourceMigration.
type correlationsTestCase struct {
	correlationUIDs []string
}

// NewCorrelationsTestCase creates a test case for the correlations migrator.
func NewCorrelationsTestCase() ResourceMigratorTestCase {
	return &correlationsTestCase{
		correlationUIDs: []string{},
	}
}

func (tc *correlationsTestCase) Name() string {
	return "correlations"
}

func (tc *correlationsTestCase) FeatureToggles() []string {
	return []string{}
}

func (tc *correlationsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *correlationsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "correlations.grafana.app",
			Version:  "v0alpha1",
			Resource: "correlations",
		},
	}
}

func (tc *correlationsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// nothing -- correlation table migrations still run on startup
}

func (tc *correlationsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	env := helper.GetEnv()
	orgID := helper.Org1.OrgID

	// Insert test correlations directly via SQL since the CorrelationsService
	// has heavy dependencies (datasource service, access control, bus, quota).
	// The migrator reads raw rows from the DB so this is sufficient.

	uid1 := "corr-test-001"
	uid2 := "corr-test-002"
	uid3 := "corr-test-003"

	config1, err := json.Marshal(map[string]any{
		"field": "traceID",
		"target": map[string]any{
			"expr": "${__value.raw}",
		},
	})
	require.NoError(t, err)

	config2, err := json.Marshal(map[string]any{
		"field": "message",
		"target": map[string]any{
			"query": "test",
		},
		"transformations": []map[string]any{
			{"type": "logfmt"},
		},
	})
	require.NoError(t, err)

	err = env.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// Query-type correlation with target
		_, err := sess.Exec(
			"INSERT INTO correlation (uid, org_id, source_uid, target_uid, label, description, config, provisioned, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			uid1, orgID, "ds-source-1", "ds-target-1", "Traces to Logs", "Link traces to logs", string(config1), false, "query",
		)
		if err != nil {
			return err
		}

		// Query-type correlation with transformations
		_, err = sess.Exec(
			"INSERT INTO correlation (uid, org_id, source_uid, target_uid, label, description, config, provisioned, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			uid2, orgID, "ds-source-2", "ds-target-2", "Logs to Metrics", "Link logs to metrics", string(config2), false, "query",
		)
		if err != nil {
			return err
		}

		// External-type correlation without target
		_, err = sess.Exec(
			"INSERT INTO correlation (uid, org_id, source_uid, target_uid, label, description, config, provisioned, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			uid3, orgID, "ds-source-3", nil, "External Link", "Link to external system", "{\"field\":\"url\",\"target\":{}}", true, "external",
		)
		return err
	})
	require.NoError(t, err)

	tc.correlationUIDs = []string{uid1, uid2, uid3}

	// Return false: the correlations legacy storage requires data sources to exist
	// for k8s API access in Mode0, which we don't set up here.
	return false
}

func (tc *correlationsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.correlationUIDs)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	correlationsCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "correlations.grafana.app",
			Version:  "v0alpha1",
			Resource: "correlations",
		},
	})

	verifyResourceCount(t, correlationsCli, expectedCount)
	for _, uid := range tc.correlationUIDs {
		verifyResource(t, correlationsCli, uid, shouldExist)
	}
}
