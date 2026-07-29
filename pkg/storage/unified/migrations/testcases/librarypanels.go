package testcases

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// libraryPanelsTestCase tests the "librarypanels" ResourceMigration.
type libraryPanelsTestCase struct {
	uids []string
}

// NewLibraryPanelsTestCase creates a test case for the library panels migrator
func NewLibraryPanelsTestCase() ResourceMigratorTestCase {
	return &libraryPanelsTestCase{
		uids: []string{},
	}
}

func (tc *libraryPanelsTestCase) Name() string {
	return "librarypanels"
}

func (tc *libraryPanelsTestCase) FeatureToggles() []string {
	return nil
}

func (tc *libraryPanelsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *libraryPanelsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		dashV0.LibraryPanelResourceInfo.GroupVersionResource(),
	}
}

func (tc *libraryPanelsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// library_element is still created on startup, nothing to add
}

func (tc *libraryPanelsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	sqlDB := helper.GetEnv().SQLStore
	cfg := helper.GetEnv().Cfg

	libraryElements := libraryelements.ProvideService(cfg, sqlDB, nil, nil, nil,
		&alwaysYesAccessControl{}, nil, nil, nil)

	// root-level library panels: folders have their own migration and test case
	for _, name := range []string{"lp-mig-test-1", "lp-mig-test-2", "lp-mig-test-3"} {
		uid := createTestLibraryPanel(t, helper, libraryElements, name, "")
		tc.uids = append(tc.uids, uid)
	}

	return true // library panels are served over k8s apis, reading from legacy in Mode0
}

func (tc *libraryPanelsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	namespace := authlib.OrgNamespaceFormatter(helper.Org1.OrgID)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       dashV0.LibraryPanelResourceInfo.GroupVersionResource(),
	})

	// No total-count assertion: the folders/dashboards test case creates a library
	// panel in the same org and the librarypanels migration moves that one too.
	for _, uid := range tc.uids {
		verifyResource(t, client, uid, shouldExist)
	}
}
