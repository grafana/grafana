package testcases

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util"
)

// foldersAndDashboardsTestCase tests the folders-dashboards ResourceMigration.
type foldersAndDashboardsTestCase struct {
	parentFolderUID   string
	childFolderUID    string
	dashboardUID      string
	largeDashboardUID string
	libPanelUID       string
}

// NewFoldersAndDashboardsTestCase creates a test case for the compound folders+dashboards migrator
func NewFoldersAndDashboardsTestCase() ResourceMigratorTestCase {
	return &foldersAndDashboardsTestCase{
		parentFolderUID: "parent-folder-uid",
		childFolderUID:  "child-folder-uid",
		dashboardUID:    "", // Will be generated during setup
		libPanelUID:     "", // Will be generated during setup
	}
}

func (tc *foldersAndDashboardsTestCase) Name() string {
	return migrations.FoldersDashboardsMigrationID
}

func (tc *foldersAndDashboardsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *foldersAndDashboardsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *foldersAndDashboardsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "folder.grafana.app",
			Version:  "v1beta1",
			Resource: "folders",
		},
		{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		},
	}
}

func (tc *foldersAndDashboardsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// nothing
}

// We need to create folders+dashboards using direct legacy SQL commands because
// all active services go directly to unified storage
func (tc *foldersAndDashboardsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	sqlDB := helper.GetEnv().SQLStore
	cfg := helper.GetEnv().Cfg

	libraryElements := libraryelements.ProvideService(cfg, sqlDB, nil, nil, nil,
		&alwaysYesAccessControl{}, nil, nil, nil)

	// Create parent folder
	parent := createTestFolder(t, helper, tc.parentFolderUID, "parent-folder", "")

	// Create child folder (nested under parent)
	child := createTestFolder(t, helper, tc.childFolderUID, "child-folder", parent)

	// Create library panel in child folder
	tc.libPanelUID = createTestLibraryPanel(t, helper, libraryElements, "Test Library Panel", child)

	// Create a large dashboard (~3MB) to test migration performance with big resources.
	// On SQLite without sufficient cache_size, large inserts cause cache spills that
	// escalate to EXCLUSIVE locks and deadlock with concurrent readers.
	tc.largeDashboardUID = createLargeDashboard(t, helper, "large-dashboard-for-migration-test", child, 3*1024*1024)

	// Create dashboard with library panel in child folder
	tc.dashboardUID = createTestDashboardWithLibraryPanel(t, helper, "dashboard-with-library-panel",
		tc.libPanelUID, "Test LP in dashboard", child)

	return false // mode0 is not supported
}

func (tc *foldersAndDashboardsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	// Build maps of UIDs by resource type
	folderUIDs := []string{tc.parentFolderUID, tc.childFolderUID}
	dashboardUIDs := []string{tc.dashboardUID, tc.largeDashboardUID}

	expectedFolderCount := 0
	if shouldExist {
		expectedFolderCount = len(folderUIDs)
	}
	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify folders
	folderCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "folder.grafana.app",
			Version:  "v1beta1",
			Resource: "folders",
		},
	})
	verifyResourceCount(t, folderCli, expectedFolderCount)
	for _, uid := range folderUIDs {
		verifyResource(t, folderCli, uid, shouldExist)
	}

	// Verify dashboards
	expectedDashboardCount := 0
	if shouldExist {
		expectedDashboardCount = len(dashboardUIDs)
	}
	dashboardCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Version:  "v1beta1",
			Resource: "dashboards",
		},
	})
	verifyResourceCount(t, dashboardCli, expectedDashboardCount)
	for _, uid := range dashboardUIDs {
		verifyResource(t, dashboardCli, uid, shouldExist)
	}
}

// createTestFolder inserts a folder directly into the legacy dashboard table.
// We write directly to the DB here because we are testing migration FROM legacy storage —
// the folder must exist in the legacy table so the migrator can read and migrate it.
func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, uid, title, parentUID string) string {
	t.Helper()

	now := time.Now()
	dash := &dashboards.Dashboard{
		UID:       uid,
		OrgID:     helper.Org1.OrgID,
		Title:     title,
		IsFolder:  true,
		FolderUID: parentUID,
		Version:   1,
		Created:   now,
		Updated:   now,
		Data:      simplejson.MustJson(fmt.Appendf([]byte{}, `{"title": "%s", "uid": "%s"}`, title, uid)),
	}
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(dash)
		return err
	})
	require.NoError(t, err)

	return uid
}

// createTestLibraryPanel creates a library panel in a folder
func createTestLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, store libraryelements.Service, name, folderUID string) string {
	t.Helper()

	libPanelPayload := fmt.Sprintf(`{
		"type": "text",
		"title": "%s"
	}`, name)

	dto, err := store.CreateElement(context.Background(),
		helper.Org1.Admin.Identity,
		model.CreateLibraryElementCommand{
			Name:      name,
			Kind:      1,
			FolderUID: &folderUID,
			Model:     json.RawMessage(libPanelPayload),
		})
	require.NoError(t, err)
	require.NotEmpty(t, dto.UID)
	return dto.UID
}

// createTestDashboardWithLibraryPanel inserts a dashboard directly into the legacy dashboard table.
// We write directly to the DB here because we are testing migration FROM legacy storage —
// the dashboard must exist in the legacy table so the migrator can read and migrate it.
func createTestDashboardWithLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, dashTitle, libPanelUID, libPanelName, folderUID string) string {
	t.Helper()

	dashPayload := fmt.Sprintf(`{
			"title": "%s",
			"panels": [{
				"id": 1,
				"libraryPanel": {
					"uid": "%s",
					"name": "%s"
				}
			}]
	}`, dashTitle, libPanelUID, libPanelName)

	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)

	now := time.Now()
	dash := &dashboards.Dashboard{
		UID:       util.GenerateShortUID(),
		OrgID:     helper.Org1.OrgID,
		CreatedBy: userID,
		FolderUID: folderUID,
		Version:   1,
		Created:   now,
		Updated:   now,
		Data:      simplejson.MustJson([]byte(dashPayload)),
	}
	err = helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(dash)
		return err
	})
	require.NoError(t, err)
	require.NotEmpty(t, dash.UID)
	return dash.UID
}

// createLargeDashboard inserts a large dashboard directly into the legacy dashboard table.
// We write directly to the DB here because we are testing migration FROM legacy storage —
// the dashboard must exist in the legacy table so the migrator can read and migrate it.
// The large size (~3MB) also exercises the migrator's handling of big payloads.
func createLargeDashboard(t *testing.T, helper *apis.K8sTestHelper, title, folderUID string, targetBytes int) string {
	t.Helper()

	// Generate padding to reach the target size. Each panel has ~100 bytes of overhead,
	// so we use a single panel with a large description field.
	padding := strings.Repeat("x", targetBytes)
	dashPayload := fmt.Sprintf(`{
		"title": "%s",
		"panels": [{
			"id": 1,
			"type": "text",
			"title": "padding",
			"options": {"content": "%s"}
		}]
	}`, title, padding)

	userID, err := helper.Org1.Admin.Identity.GetInternalID()
	require.NoError(t, err)

	now := time.Now()
	dash := &dashboards.Dashboard{
		UID:       util.GenerateShortUID(),
		OrgID:     helper.Org1.OrgID,
		CreatedBy: userID,
		FolderUID: folderUID,
		Version:   1,
		Created:   now,
		Updated:   now,
		Data:      simplejson.MustJson([]byte(dashPayload)),
	}
	err = helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(dash)
		return err
	})
	require.NoError(t, err)
	require.NotEmpty(t, dash.UID)
	t.Logf("Created large dashboard %s (%d bytes)", dash.UID, targetBytes)
	return dash.UID
}

var (
	_ accesscontrol.AccessControl = (*alwaysYesAccessControl)(nil)
)

type alwaysYesAccessControl struct{}

// Evaluate implements [accesscontrol.AccessControl].
func (a *alwaysYesAccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return true, nil
}

// InvalidateResolverCache implements [accesscontrol.AccessControl].
func (a *alwaysYesAccessControl) InvalidateResolverCache(orgID int64, scope string) {
	panic("unimplemented")
}

// RegisterScopeAttributeResolver implements [accesscontrol.AccessControl].
func (a *alwaysYesAccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	panic("unimplemented")
}

// WithoutResolvers implements [accesscontrol.AccessControl].
func (a *alwaysYesAccessControl) WithoutResolvers() accesscontrol.AccessControl {
	panic("unimplemented")
}
