package testcases

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	return []string{featuremgmt.FlagKubernetesCorrelations}
}

func (tc *correlationsTestCase) RenameTables() []string {
	return []string{"correlation"}
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
	// correlation table is still created on startup, nothing to add
}

func (tc *correlationsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	orgID := helper.Org1.OrgID

	// Create source and target datasources for the correlations
	srcDS := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: orgID,
		Name:  "corr-source-ds",
		Type:  "grafana-testdata-datasource",
		URL:   "http://localhost",
	})

	targetDS := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: orgID,
		Name:  "corr-target-ds",
		Type:  "grafana-testdata-datasource",
		URL:   "http://localhost",
	})

	store := helper.GetEnv().SQLStore

	// Insert a query-type correlation with a target
	uid1 := "corr-mig-test-1"
	insertCorrelation(t, store, &correlations.Correlation{
		UID:         uid1,
		OrgID:       orgID,
		SourceUID:   srcDS.UID,
		TargetUID:   &targetDS.UID,
		Label:       "Logs to Traces",
		Description: "Navigate from logs to traces",
		Config: correlations.CorrelationConfig{
			Field:  "traceID",
			Target: map[string]any{"expr": "${__value.raw}"},
		},
		Provisioned: false,
		Type:        "query",
	})
	tc.correlationUIDs = append(tc.correlationUIDs, uid1)

	// Insert an external-type correlation without a target
	uid2 := "corr-mig-test-2"
	insertCorrelation(t, store, &correlations.Correlation{
		UID:         uid2,
		OrgID:       orgID,
		SourceUID:   srcDS.UID,
		Label:       "External Link",
		Description: "Link to external service",
		Config: correlations.CorrelationConfig{
			Field:  "url",
			Target: map[string]any{"url": "https://example.com/${__value.raw}"},
		},
		Provisioned: false,
		Type:        "external",
	})
	tc.correlationUIDs = append(tc.correlationUIDs, uid2)

	// Insert a provisioned correlation
	uid3 := "corr-mig-test-3"
	insertCorrelation(t, store, &correlations.Correlation{
		UID:         uid3,
		OrgID:       orgID,
		SourceUID:   srcDS.UID,
		TargetUID:   &targetDS.UID,
		Label:       "Provisioned Correlation",
		Description: "Created via provisioning",
		Config: correlations.CorrelationConfig{
			Field:  "spanID",
			Target: map[string]any{"expr": "${__value.raw}"},
		},
		Provisioned: true,
		Type:        "query",
	})
	tc.correlationUIDs = append(tc.correlationUIDs, uid3)

	return false // correlations K8s API requires kubernetesCorrelations toggle, not available in Mode0 by default
}

func (tc *correlationsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.correlationUIDs)
	}

	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "correlations.grafana.app",
			Version:  "v0alpha1",
			Resource: "correlations",
		},
	})

	verifyResourceCount(t, client, expectedCount)
	for _, uid := range tc.correlationUIDs {
		verifyResource(t, client, uid, shouldExist)
	}
}

// insertCorrelation inserts a correlation row directly into the legacy
// correlation table.
func insertCorrelation(t *testing.T, store db.DB, corr *correlations.Correlation) {
	t.Helper()
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Omit("source_type", "target_type").Insert(corr)
		return err
	})
	require.NoError(t, err)
}
