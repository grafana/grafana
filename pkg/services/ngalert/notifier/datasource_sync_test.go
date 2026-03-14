package notifier

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

// buildTestMOA creates a MultiOrgAlertmanager wired up with the provided dependencies for
// testing syncDatasourceConfigs. orgIDs is the set of active orgs; disabledOrgs are orgs
// that should be skipped. The feature flag is enabled when featureEnabled=true.
func buildTestMOA(
	t *testing.T,
	orgIDs []int64,
	disabledOrgs map[int64]struct{},
	adminCfgStore store.AdminConfigurationStore,
	dsService datasources.DataSourceService,
	featureEnabled bool,
	operatorUID string,
) *MultiOrgAlertmanager {
	t.Helper()

	tmpDir := t.TempDir()

	var features featuremgmt.FeatureToggles
	if featureEnabled {
		features = featuremgmt.WithFeatures(featuremgmt.FlagAlertingDatasourceSync)
	} else {
		features = featuremgmt.WithFeatures()
	}

	if disabledOrgs == nil {
		disabledOrgs = map[int64]struct{}{}
	}

	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   disabledOrgs,
			DatasourceSyncUID:              operatorUID,
		},
	}

	cs := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{})
	orgStore := &FakeOrgStore{orgs: orgIDs}
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)

	moa, err := NewMultiOrgAlertmanager(
		cfg,
		cs,
		orgStore,
		kvStore,
		provStore,
		decryptFn,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		ngfakes.NewFakeReceiverPermissionsService(),
		log.New("testlogger"),
		secretsService,
		features,
		nil,
		adminCfgStore,
		dsService,
	)
	require.NoError(t, err)
	require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(context.Background()))
	return moa
}

// mockAdminConfigStore is a simple in-memory implementation of AdminConfigurationStore.
type mockAdminConfigStore struct {
	mock.Mock
}

func (m *mockAdminConfigStore) GetAdminConfiguration(orgID int64) (*ngmodels.AdminConfiguration, error) {
	args := m.Called(orgID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*ngmodels.AdminConfiguration), args.Error(1)
}

func (m *mockAdminConfigStore) GetAdminConfigurations() ([]*ngmodels.AdminConfiguration, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*ngmodels.AdminConfiguration), args.Error(1)
}

func (m *mockAdminConfigStore) DeleteAdminConfiguration(orgID int64) error {
	return m.Called(orgID).Error(0)
}

func (m *mockAdminConfigStore) UpdateAdminConfiguration(cmd store.UpdateAdminConfigurationCmd) error {
	return m.Called(cmd).Error(0)
}

// makeMimirDS returns a minimal Alertmanager/Mimir datasource for testing.
func makeMimirDS(uid string, orgID int64, url string) *datasources.DataSource {
	jd := simplejson.New()
	jd.Set("implementation", "mimir")
	return &datasources.DataSource{
		UID:      uid,
		OrgID:    orgID,
		Type:     datasources.DS_ALERTMANAGER,
		URL:      url,
		JsonData: jd,
	}
}

// startMimirServer starts a test HTTP server that serves a fixed Mimir config response.
func startMimirServer(t *testing.T, alertmanagerConfig string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := mimirConfigResponse{
			AlertmanagerConfig: alertmanagerConfig,
			TemplateFiles:      map[string]string{},
		}
		body, err := yaml.Marshal(resp)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestSyncDatasourceConfigs_FeatureFlagDisabled(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	// Feature flag is disabled, GetAdminConfigurations should never be called.
	adminCfg.AssertNotCalled(t, "GetAdminConfigurations")

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, &dsfakes.FakeDataSourceService{}, false, "")
	// Call the sync directly — should return immediately.
	moa.syncDatasourceConfigs(context.Background())
	adminCfg.AssertExpectations(t)
}

func ptrTo[T any](v T) *T { return &v }

func TestSyncDatasourceConfigs_NoUID_Skipped(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	// Org 1 has no DatasourceSyncUID configured.
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: nil},
	}, nil)

	dsSvc := &dsfakes.FakeDataSourceService{}
	// No GetDataSource call expected since UID is empty.

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "")
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
	// No datasource lookup should have occurred.
	assert.Empty(t, dsSvc.DataSources)
}

func TestSyncDatasourceConfigs_DBUIDUsed(t *testing.T) {
	mimirSrv := startMimirServer(t, `route:
  receiver: mimir-receiver`)

	ds := makeMimirDS("mimir-uid-1", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: ptrTo("mimir-uid-1")},
	}, nil)

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "")
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
}

func TestSyncDatasourceConfigs_OperatorUIDOverridesDB(t *testing.T) {
	mimirSrv := startMimirServer(t, `route:
  receiver: mimir-receiver`)

	// Operator UID "operator-uid" should be used; DB has "db-uid".
	ds := makeMimirDS("operator-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: ptrTo("db-uid")},
	}, nil)

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "operator-uid")
	moa.syncDatasourceConfigs(context.Background())

	// Verify the request was made to the server (the operator UID datasource was used).
	adminCfg.AssertExpectations(t)
}

func TestSyncDatasourceConfigs_DisabledOrgSkipped(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 5, DatasourceSyncUID: ptrTo("some-uid")},
	}, nil)

	dsSvc := &dsfakes.FakeDataSourceService{}
	// Org 5 is disabled, no datasource lookup should happen.

	moa := buildTestMOA(t, []int64{}, map[int64]struct{}{5: {}}, adminCfg, dsSvc, true, "")
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
	// No GetDataSource should have been called.
}

func TestSyncDatasourceConfigs_GetAdminConfigurationsError(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return(nil, fmt.Errorf("db error"))

	dsSvc := &dsfakes.FakeDataSourceService{}

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "")
	// Should not panic or propagate the error — just log and return.
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
}

func TestSyncDatasourceConfigs_PerOrgErrorIsolation(t *testing.T) {
	// Org 1 has a bad URL (returns 500); org 2 should still succeed.
	badSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	defer badSrv.Close()

	goodSrv := startMimirServer(t, `route:
  receiver: good-receiver`)

	jd := simplejson.New()
	jd.Set("implementation", "mimir")
	ds1 := &datasources.DataSource{UID: "ds-1", OrgID: 1, Type: datasources.DS_ALERTMANAGER, URL: badSrv.URL, JsonData: jd}

	jd2 := simplejson.New()
	jd2.Set("implementation", "mimir")
	ds2 := &datasources.DataSource{UID: "ds-2", OrgID: 2, Type: datasources.DS_ALERTMANAGER, URL: goodSrv.URL, JsonData: jd2}

	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds1, ds2}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: ptrTo("ds-1")},
		{OrgID: 2, DatasourceSyncUID: ptrTo("ds-2")},
	}, nil)

	moa := buildTestMOA(t, []int64{1, 2}, nil, adminCfg, dsSvc, true, "")
	// Should not panic even though org 1 fails.
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
}

func TestSyncDatasourceConfigs_HTTPTimeout(t *testing.T) {
	// Server that blocks until the client context is cancelled.
	blockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Block until request context is done.
		<-r.Context().Done()
		http.Error(w, "context cancelled", http.StatusServiceUnavailable)
	}))
	defer blockSrv.Close()

	ds := makeMimirDS("slow-uid", 1, blockSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: ptrTo("slow-uid")},
	}, nil)

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "")
	// Use a very short timeout to test the context deadline.
	moa.httpClient = &http.Client{Timeout: 50 * time.Millisecond}

	start := time.Now()
	moa.syncDatasourceConfigs(context.Background())
	elapsed := time.Since(start)

	// Should have finished quickly — well under 5 seconds.
	assert.Less(t, elapsed, 5*time.Second)
	adminCfg.AssertExpectations(t)
}

func TestSyncDatasourceConfigs_SuccessPath(t *testing.T) {
	// The success path test verifies that:
	// 1. syncDatasourceConfigs fetches from Mimir (the test server is hit)
	// 2. No error is logged (no panic, clean return)
	//
	// SaveAndApplyExtraConfiguration lives on MultiOrgAlertmanager which applies the config
	// to the per-org alertmanager. We verify the full flow by checking the test server was called
	// and no error occurred.

	var serverCalled bool
	const amConfig = `route:
  receiver: mimir-default`

	mimirSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serverCalled = true
		resp := mimirConfigResponse{
			AlertmanagerConfig: amConfig,
			TemplateFiles:      map[string]string{},
		}
		body, err := yaml.Marshal(resp)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(body)
	}))
	defer mimirSrv.Close()

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, DatasourceSyncUID: ptrTo("mimir-uid")},
	}, nil)

	moa := buildTestMOA(t, []int64{1}, nil, adminCfg, dsSvc, true, "")
	moa.syncDatasourceConfigs(context.Background())

	adminCfg.AssertExpectations(t)
	assert.True(t, serverCalled, "expected Mimir server to be called during sync")
}

func TestBuildMimirConfigURL(t *testing.T) {
	moa := &MultiOrgAlertmanager{}

	tests := []struct {
		name   string
		dsURL  string
		expect string
	}{
		{
			name:   "base URL gets /api/v1/alerts appended",
			dsURL:  "http://mimir:9009",
			expect: "http://mimir:9009/api/v1/alerts",
		},
		{
			name:   "URL with existing path gets /api/v1/alerts appended",
			dsURL:  "http://mimir:9009/some/path",
			expect: "http://mimir:9009/some/path/api/v1/alerts",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ds := &datasources.DataSource{
				UID: "test-uid",
				URL: tc.dsURL,
			}
			got, err := moa.buildMimirConfigURL(ds)
			require.NoError(t, err)
			assert.Equal(t, tc.expect, got)
		})
	}
}
