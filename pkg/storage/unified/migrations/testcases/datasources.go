package testcases

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
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
		featuremgmt.FlagQueryServiceWithConnections, // required for CRUD
	}
}

func (tc *datasourcesTestCase) RenameTables() []string {
	return []string{}
}

func (tc *datasourcesTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "*.datasource.grafana.app",
			Version:  "v0alpha1",
			Resource: "datasources",
		},
	}
}

func (tc *datasourcesTestCase) AddLegacySQLMigrations(mg *migrator.Migrator) {}

func (tc *datasourcesTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) bool {
	t.Helper()

	env := helper.GetEnv()

	sqlStore := env.SQLStore
	features := featuremgmt.WithFeatures()
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore()) // TODO -- I don't think this can be fake!
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	mockPermission := acmock.NewMockedPermissionsService()
	mockPermission.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	quotaService := quotatest.New(false, nil)
	dsRetriever := dsservice.ProvideDataSourceRetriever(sqlStore, features)
	dsService, err := dsservice.ProvideService(sqlStore, secretsService, secretsStore, env.Cfg, features,
		actest.FakeAccessControl{}, mockPermission,
		quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{},
		plugincontext.ProvideBaseService(env.Cfg, pluginconfig.NewFakePluginRequestConfigProvider()), dsRetriever)
	require.NoError(t, err)

	ds, err := dsService.AddDataSource(t.Context(), &datasources.AddDataSourceCommand{
		Name: "test",
		Type: "grafana-testdata-datasource",
		URL:  "http://localhost",
		SecureJsonData: map[string]string{
			"secret": "xyz",
		},
	})
	require.NoError(t, err)
	tc.testdata = append(tc.testdata, ds.UID)

	return false // TODO, should be true! should be supported by mode0 (legacy API)
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
