package testcases

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	encryptionprovider "github.com/grafana/grafana/pkg/services/encryption/provider"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// snapshotsTestCase tests the "snapshots" ResourceMigration.
type snapshotsTestCase struct {
	keys     []string
	localKey string
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
	// Snapshots are served over the k8s apis (see Setup below), which now denies
	// requests when this toggle is off.
	return []string{featuremgmt.FlagSnapshotsKubernetesSnapshots}
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
		insertLegacySnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
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

	cfg := helper.GetEnv().Cfg
	enc, err := encryptionservice.ProvideEncryptionService(tracing.InitializeTracerForTest(), encryptionprovider.Provider{}, &usagestats.UsageStatsMock{}, cfg)
	require.NoError(t, err)
	body := []byte(`{"title":"Migrated dashboard","panels":[],"snapshotData":[1,2,3]}`)
	encrypted, err := enc.Encrypt(t.Context(), body, cfg.SectionWithEnvOverrides("security").Key("secret_key").Value())
	require.NoError(t, err)
	require.NotEqual(t, body, encrypted)
	tc.localKey = "snapshot-mig-local"
	insertLegacySnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
		OrgID: orgID, Name: "Local migration test", Key: tc.localKey, DeleteKey: tc.localKey + "-delete",
		DashboardEncrypted: encrypted, Expires: expires, Created: now, Updated: now,
	})
	tc.keys = append(tc.keys, tc.localKey)

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
	if !shouldExist {
		return
	}

	snap, err := client.Resource.Get(t.Context(), tc.localKey, metav1.GetOptions{})
	require.NoError(t, err)
	cfg := helper.GetEnv().Cfg.UnifiedStorage["snapshots.dashboard.grafana.app"]
	if cfg.EnableMigration || cfg.DualWriterMode != grafanarest.Mode0 {
		spec := snap.Object["spec"].(map[string]any)
		require.NotContains(t, spec, "dashboard")
		blobs := snap.Object["blobs"].(map[string]any)
		ref := blobs["dashboard"].(map[string]any)
		require.NotEmpty(t, ref["uid"])
		require.NotContains(t, ref, "data")
	}
	readback := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: fmt.Sprintf("/apis/%s/namespaces/%s/snapshots/%s/dashboard", dashV0.APIVERSION, namespace, tc.localKey),
	}, &dashV0.Dashboard{})
	require.Equal(t, http.StatusOK, readback.Response.StatusCode, string(readback.Body))
	body, err := json.Marshal(readback.Result.Spec.Object)
	require.NoError(t, err)
	require.JSONEq(t, `{"title":"Migrated dashboard","panels":[],"snapshotData":[1,2,3]}`, string(body))
}

// insertLegacySnapshot inserts a snapshot row directly into the legacy
// dashboard_snapshot table. delete_key has a UNIQUE constraint, so callers must
// provide a distinct value.
func insertLegacySnapshot(t *testing.T, store db.DB, snap *dashboardsnapshots.DashboardSnapshot) {
	t.Helper()
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(snap)
		return err
	})
	require.NoError(t, err)
}
