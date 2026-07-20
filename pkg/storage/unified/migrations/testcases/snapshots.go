package testcases

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// snapshotsTestCase tests the "snapshots" ResourceMigration.
//
// It seeds external snapshots only: external snapshots carry no encrypted
// dashboard payload, so the migration never invokes the secrets service and the
// rows can be inserted directly. Decryption of internal snapshots is covered by
// the migrator's own integration test.
type snapshotsTestCase struct {
	keys []string
}

// NewSnapshotsTestCase creates a test case for the snapshots migrator
func NewSnapshotsTestCase() ResourceMigratorTestCase {
	return &snapshotsTestCase{
		keys: []string{},
	}
}

func (tc *snapshotsTestCase) Name() string {
	return "snapshots"
}

func (tc *snapshotsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *snapshotsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *snapshotsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		dashV0.SnapshotResourceInfo.GroupVersionResource(),
	}
}

func (tc *snapshotsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// dashboard_snapshot is still created on startup, nothing to add
}

func (tc *snapshotsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	store := helper.GetEnv().SQLStore
	orgID := helper.Org1.OrgID
	now := time.Now().UTC().Truncate(time.Second)
	expires := now.Add(time.Hour)

	snapshots := []struct {
		key string
		url string
	}{
		{key: "snapshot-mig-test-1", url: "https://example.com/snapshot/1"},
		{key: "snapshot-mig-test-2", url: "https://example.com/snapshot/2"},
		{key: "snapshot-mig-test-3", url: "https://example.com/snapshot/3"},
	}

	for _, s := range snapshots {
		insertExternalSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID:       orgID,
			Name:        s.key,
			Key:         s.key,
			DeleteKey:   s.key + "-delete",
			External:    true,
			ExternalURL: s.url,
			Expires:     expires,
			Created:     now,
			Updated:     now,
		})
		tc.keys = append(tc.keys, s.key)
	}

	return true // snapshots are served over k8s apis, reading from legacy in Mode0
}

func (tc *snapshotsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.keys)
	}

	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       dashV0.SnapshotResourceInfo.GroupVersionResource(),
	})

	verifyResourceCount(t, client, expectedCount)
	// The k8s resource name is the snapshot key.
	for _, key := range tc.keys {
		verifyResource(t, client, key, shouldExist)
	}
}

// insertExternalSnapshot inserts a snapshot row directly into the legacy
// dashboard_snapshot table. delete_key has a UNIQUE constraint, so callers must
// provide a distinct value.
func insertExternalSnapshot(t *testing.T, store db.DB, snap *dashboardsnapshots.DashboardSnapshot) {
	t.Helper()
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(snap)
		return err
	})
	require.NoError(t, err)
}
