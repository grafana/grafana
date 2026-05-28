package testcases

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashboardsnapshotsdb "github.com/grafana/grafana/pkg/services/dashboardsnapshots/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// snapshotsTestCase tests the "snapshots" ResourceMigration
type snapshotsTestCase struct {
	snapshotKeys []string
}

// NewSnapshotsTestCase creates a test case for the snapshots migrator
func NewSnapshotsTestCase() ResourceMigratorTestCase {
	return &snapshotsTestCase{
		snapshotKeys: []string{},
	}
}

func (tc *snapshotsTestCase) Name() string {
	return "snapshots"
}

func (tc *snapshotsTestCase) FeatureToggles() []string {
	return []string{featuremgmt.FlagKubernetesSnapshots}
}

func (tc *snapshotsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *snapshotsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    dashV0.APIGroup,
			Version:  dashV0.VERSION,
			Resource: "snapshots",
		},
	}
}

func (tc *snapshotsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// dashboard_snapshot is created by the default SQL migrations.
}

func (tc *snapshotsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	// Setup writes via the legacy store directly. The store does not encrypt — it
	// stores whatever bytes are in cmd.DashboardEncrypted (here: nil). The migrator
	// therefore falls back to the plaintext `dashboard` column for these rows. The
	// encrypted-blob decryption path is covered by unit tests on the migrator.
	env := helper.GetEnv()
	store := dashboardsnapshotsdb.NewStore(env.SQLStore)

	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)
	orgID := helper.Org1.OrgID

	keys := []string{
		"snap-test-key-1",
		"snap-test-key-2",
		"snap-test-key-3",
	}

	for i, key := range keys {
		cmd := &dashboardsnapshots.CreateDashboardSnapshotCommand{
			DashboardCreateCommand: dashV0.DashboardCreateCommand{
				Name:      "Test snapshot " + key,
				Dashboard: &common.Unstructured{Object: map[string]interface{}{"title": "test"}},
			},
			Key:       key,
			DeleteKey: "snap-test-delete-" + key,
			OrgID:     orgID,
			UserID:    userID,
		}
		if i == 1 {
			cmd.External = true
			cmd.ExternalURL = "https://snapshots.example.com/" + key
			cmd.ExternalDeleteURL = "https://snapshots.example.com/delete/" + key
		}
		_, err := store.CreateDashboardSnapshot(context.Background(), cmd)
		require.NoError(t, err)
		tc.snapshotKeys = append(tc.snapshotKeys, key)
	}

	return true
}

func (tc *snapshotsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.snapshotKeys)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	snapshotCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    dashV0.APIGroup,
			Version:  dashV0.VERSION,
			Resource: "snapshots",
		},
	})

	verifyResourceCount(t, snapshotCli, expectedCount)
	for _, key := range tc.snapshotKeys {
		verifyResource(t, snapshotCli, key, shouldExist)
	}
}
