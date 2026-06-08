package testcases

import (
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// datasourcesTestCase tests the "datasources" ResourceMigration
type datasourcesTestCase struct {
	testdata []string
}

// NewPlaylistsTestCase creates a test case for the datasources migrator
func NewDataSourceTestCase() ResourceMigratorTestCase {
	return &datasourcesTestCase{
		testdata: []string{},
	}
}

func (tc *datasourcesTestCase) Name() string {
	return "datasources"
}

func (tc *datasourcesTestCase) FeatureToggles() []string {
	return []string{
		featuremgmt.FlagDatasourceUseNewCRUDAPIs, // required for CRUD
	}
}

func (tc *datasourcesTestCase) RenameTables() []string {
	return []string{}
}

func (tc *datasourcesTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "grafana-testdata-datasource.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		},
		{
			Group:    "datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		},
	}
}

func (tc *datasourcesTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {}

func (tc *datasourcesTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	ds := helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "test1",
		Type:  "grafana-testdata-datasource",
		URL:   "http://localhost",
		SecureJsonData: map[string]string{
			"test1": "abc",
		},
	})
	tc.testdata = append(tc.testdata, ds.UID)

	ds = helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "test2",
		Type:  "grafana-testdata-datasource",
		URL:   "http://localhost",
		SecureJsonData: map[string]string{
			"test2": "xyz",
		},
	})
	tc.testdata = append(tc.testdata, ds.UID)

	return true
}

func (tc *datasourcesTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedTestDataCount := 0
	if shouldExist {
		expectedTestDataCount = len(tc.testdata)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	// Verify datasources
	tdClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "grafana-testdata-datasource.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		},
	})

	verifyResourceCount(t, tdClient, expectedTestDataCount)
	for _, uid := range tc.testdata {
		verifyResource(t, tdClient, uid, shouldExist)
	}
}
