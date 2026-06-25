package testcases

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// libraryPanelsTestCase tests the "librarypanels" ResourceMigration
type libraryPanelsTestCase struct {
	libraryPanelUIDs []string
}

// NewLibraryPanelsTestCase creates a test case for the library panels migrator
func NewLibraryPanelsTestCase() ResourceMigratorTestCase {
	return &libraryPanelsTestCase{
		libraryPanelUIDs: []string{},
	}
}

func (tc *libraryPanelsTestCase) Name() string {
	return "librarypanels"
}

func (tc *libraryPanelsTestCase) FeatureToggles() []string {
	return []string{featuremgmt.FlagKubernetesLibraryPanels}
}

func (tc *libraryPanelsTestCase) RenameTables() []string {
	return []string{}
}

func (tc *libraryPanelsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "dashboard.grafana.app",
			Version:  "v0alpha1",
			Resource: "librarypanels",
		},
	}
}

func (tc *libraryPanelsTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {
	// library_element is created by the standard migrations on startup.
}

func (tc *libraryPanelsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	sqlDB := helper.GetEnv().SQLStore
	cfg := helper.GetEnv().Cfg
	libraryElements := libraryelements.ProvideService(cfg, sqlDB, nil, nil, nil,
		&alwaysYesAccessControl{}, nil, nil, nil)

	tc.libraryPanelUIDs = append(tc.libraryPanelUIDs,
		createTestLibraryPanel(t, helper, libraryElements, "Library Panel A", ""),
		createTestLibraryPanel(t, helper, libraryElements, "Library Panel B", ""),
		createTestLibraryPanel(t, helper, libraryElements, "Library Panel C", ""),
	)

	// The LibraryPanelStore serves reads directly from the legacy library_element
	// table, so panels created via libraryelements.Service are visible through the
	// K8s API even in Mode 0.
	return true
}

func (tc *libraryPanelsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	cli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Version:  "v0alpha1",
			Resource: "librarypanels",
		},
	})

	// Other test cases (e.g. folders_dashboards) also create library panels in
	// the same group, so we check per-UID rather than asserting a total count.
	for _, uid := range tc.libraryPanelUIDs {
		verifyResource(t, cli, uid, shouldExist)
	}
}
