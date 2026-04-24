package notifier

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

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

// ptrTo returns a pointer to v.
func ptrTo[T any](v T) *T { return &v }

// mockAdminConfigStore is a simple test double for AdminConfigurationStore.
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

// buildSyncTestMOA builds a MultiOrgAlertmanager wired for testing syncExternalAMs.
// It returns the MOA and its underlying config store so callers can assert on saved configs.
func buildSyncTestMOA(
	t *testing.T,
	adminCfgStore store.AdminConfigurationStore,
	dsService datasources.DataSourceService,
	featureEnabled bool,
	operatorUID string,
) (*MultiOrgAlertmanager, *fakeConfigStore) {
	t.Helper()

	if featureEnabled {
		require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagAlertingSyncExternalAlertmanager: {
				DefaultVariant: "on",
				Variants:       map[string]any{"on": true},
			},
		})))
		t.Cleanup(func() { _ = openfeature.SetProvider(openfeature.NoopProvider{}) })
	}

	cs := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{})
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)

	moa, err := NewMultiOrgAlertmanager(
		&setting.Cfg{
			DataPath: t.TempDir(),
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				AlertmanagerConfigPollInterval: 3 * time.Minute,
				DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
				ExternalAlertmanagerUID:        operatorUID,
			},
		},
		cs,
		&FakeOrgStore{},
		kvStore,
		provStore,
		secretsService.GetDecryptedValue,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		ngfakes.NewFakeReceiverPermissionsService(),
		ngfakes.NewFakeRoutePermissionsService(),
		log.New("test.external_am_sync"),
		secretsService,
		featuremgmt.WithFeatures(),
		nil,
		false,
		adminCfgStore,
		dsService,
	)
	require.NoError(t, err)
	return moa, cs
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

// startMimirServer starts a test HTTP server serving a fixed Mimir config response.
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

func TestSyncExternalAMs_FeatureFlagDisabled(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, false, "")
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertNotCalled(t, "GetAdminConfigurations")
	_, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)
}

func TestSyncExternalAMs_NoUID_Skipped(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: nil},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "")
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	_, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)
}

func TestSyncExternalAMs_OperatorUIDOverridesDB(t *testing.T) {
	mimirSrv := startMimirServer(t, "route:\n  receiver: mimir-receiver\nreceivers:\n  - name: mimir-receiver")

	// Operator UID "operator-uid" should win over DB value "db-uid".
	ds := makeMimirDS("operator-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("db-uid")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "operator-uid")
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "operator-uid", cfg.ExtraConfigs[0].Identifier)
}

func TestSyncExternalAMs_GetAdminConfigurationsError(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return(nil, fmt.Errorf("db error"))

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "")
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	_, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)
}

func TestSyncExternalAMs_PerOrgErrorIsolation(t *testing.T) {
	// Org 1 returns HTTP 500; org 2 succeeds — the error must not abort org 2.
	badSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	defer badSrv.Close()

	goodSrv := startMimirServer(t, "route:\n  receiver: good-receiver\nreceivers:\n  - name: good-receiver")

	jd := simplejson.New()
	jd.Set("implementation", "mimir")
	ds1 := &datasources.DataSource{UID: "ds-1", OrgID: 1, Type: datasources.DS_ALERTMANAGER, URL: badSrv.URL, JsonData: jd}

	jd2 := simplejson.New()
	jd2.Set("implementation", "mimir")
	ds2 := &datasources.DataSource{UID: "ds-2", OrgID: 2, Type: datasources.DS_ALERTMANAGER, URL: goodSrv.URL, JsonData: jd2}

	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds1, ds2}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("ds-1")},
		{OrgID: 2, ExternalAlertmanagerUID: ptrTo("ds-2")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "")
	moa.syncExternalAMs(context.Background(), []int64{1, 2})

	adminCfg.AssertExpectations(t)

	// Org 1 failed — no config saved.
	_, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)

	// Org 2 succeeded — config saved with correct identifier.
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 2)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "ds-2", cfg.ExtraConfigs[0].Identifier)

	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1", "error")))
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("2", "success")))
}

func TestSyncExternalAMs_HTTPTimeout(t *testing.T) {
	// Server that blocks until the client disconnects.
	blockSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		http.Error(w, "context cancelled", http.StatusServiceUnavailable)
	}))
	defer blockSrv.Close()

	ds := makeMimirDS("slow-uid", 1, blockSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("slow-uid")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "")
	moa.httpClient = &http.Client{Timeout: 50 * time.Millisecond}

	start := time.Now()
	moa.syncExternalAMs(context.Background(), []int64{1})
	elapsed := time.Since(start)

	assert.Less(t, elapsed, 5*time.Second)
	adminCfg.AssertExpectations(t)
	_, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1", "error")))
}

func TestSyncExternalAMs_SuccessPath(t *testing.T) {
	const amConfig = "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default"

	mimirSrv := startMimirServer(t, amConfig)

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("mimir-uid")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "")
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "mimir-uid", cfg.ExtraConfigs[0].Identifier)
	assert.NotEmpty(t, cfg.ExtraConfigs[0].AlertmanagerConfig)

	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1", "success")))
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
