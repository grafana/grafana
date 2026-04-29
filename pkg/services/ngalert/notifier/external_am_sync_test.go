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
	"github.com/grafana/grafana/pkg/infra/httpclient"
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
	"github.com/grafana/grafana/pkg/services/validations"
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
// It bootstraps a default Alertmanager configuration and registers an Alertmanager
// instance for each org in orgIDs (via LoadAndSyncAlertmanagersForOrgs) so that
// syncExternalAMs can call SaveAndApplyExtraConfiguration without tripping on a
// missing primary config. The feature flag is enabled (when requested) only after
// bootstrap so the bootstrap call to syncExternalAMs is a no-op and does not
// trigger admin-config-store mock expectations.
func buildSyncTestMOA(
	t *testing.T,
	adminCfgStore store.AdminConfigurationStore,
	dsService datasources.DataSourceService,
	featureEnabled bool,
	operatorUID string,
	orgIDs []int64,
	validator ...validations.DataSourceRequestValidator,
) (*MultiOrgAlertmanager, *fakeConfigStore) {
	t.Helper()

	cs := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{})
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)

	var v validations.DataSourceRequestValidator = &validations.OSSDataSourceRequestValidator{}
	if len(validator) > 0 && validator[0] != nil {
		v = validator[0]
	}

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
		NewFakeOrgStore(t, orgIDs),
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
		httpclient.NewProvider(),
		v,
	)
	require.NoError(t, err)

	// Bootstrap: seeds default Alertmanager configurations and registers Alertmanager
	// instances for each org. The internal call to syncExternalAMs is a no-op here
	// because the feature flag has not been enabled yet.
	require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(context.Background()))

	if featureEnabled {
		require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagAlertingSyncExternalAlertmanager: {
				DefaultVariant: "on",
				Variants:       map[string]any{"on": true},
			},
		})))
		t.Cleanup(func() { _ = openfeature.SetProvider(openfeature.NoopProvider{}) })
	}

	return moa, cs
}

// assertNoExtraConfigSaved asserts that the saved Alertmanager configuration for
// orgID has no ExtraConfigs — i.e. the sync did not write one (either because it
// was skipped or because it failed).
func assertNoExtraConfigSaved(t *testing.T, cs *fakeConfigStore, orgID int64) {
	t.Helper()
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), orgID)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	assert.Empty(t, cfg.ExtraConfigs, "no ExtraConfig should have been saved")
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

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, false, "", []int64{1})
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertNotCalled(t, "GetAdminConfigurations")
	assertNoExtraConfigSaved(t, cs, 1)
}

func TestSyncExternalAMs_NoUID_Skipped(t *testing.T) {
	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: nil},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "", []int64{1})
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	assertNoExtraConfigSaved(t, cs, 1)
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

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "operator-uid", []int64{1})
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

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "", []int64{1})
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	assertNoExtraConfigSaved(t, cs, 1)
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

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1, 2})
	moa.syncExternalAMs(context.Background(), []int64{1, 2})

	adminCfg.AssertExpectations(t)

	// Org 1 failed — no ExtraConfig saved (default config remains).
	assertNoExtraConfigSaved(t, cs, 1)

	// Org 2 succeeded — config saved with correct identifier.
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 2)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "ds-2", cfg.ExtraConfigs[0].Identifier)

	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("2")))
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

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	// Bound the parent context so the request returns quickly via context cancellation
	// rather than the HTTP client's hard 10s timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	moa.syncExternalAMs(ctx, []int64{1})
	elapsed := time.Since(start)

	assert.Less(t, elapsed, 5*time.Second)
	adminCfg.AssertExpectations(t)
	assertNoExtraConfigSaved(t, cs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
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

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})
	moa.syncExternalAMs(context.Background(), []int64{1})

	adminCfg.AssertExpectations(t)
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "mimir-uid", cfg.ExtraConfigs[0].Identifier)
	assert.NotEmpty(t, cfg.ExtraConfigs[0].AlertmanagerConfig)

	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))
}

func TestSyncExternalAMs_DedupOnIdenticalResponse(t *testing.T) {
	const amConfig = "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default"

	mimirSrv := startMimirServer(t, amConfig)

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("mimir-uid")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	// First tick: stores the config and writes a history row on top of the
	// bootstrap default. Bootstrap counts as one history entry; the first sync
	// adds a second.
	moa.syncExternalAMs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2)

	// Second tick on byte-identical Mimir output: hash matches the cached value
	// for org 1, so SaveAndApplyExtraConfiguration is not called and no new
	// history row is written.
	moa.syncExternalAMs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2, "no-op sync should not write a new history row")

	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncSkipped.WithLabelValues("1")))
}

func TestSyncExternalAMs_SavesWhenResponseChanges(t *testing.T) {
	// Server flips the response on the second call so the body hash differs and
	// the sync re-saves.
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		amCfg := "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default"
		if calls > 1 {
			amCfg = "route:\n  receiver: mimir-changed\nreceivers:\n  - name: mimir-changed"
		}
		resp := mimirConfigResponse{AlertmanagerConfig: amCfg, TemplateFiles: map[string]string{}}
		body, err := yaml.Marshal(resp)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	ds := makeMimirDS("mimir-uid", 1, srv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("mimir-uid")},
	}, nil)

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	moa.syncExternalAMs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2, "first sync writes one history row on top of bootstrap")

	moa.syncExternalAMs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 3, "different response bytes should trigger a new save")

	assert.Equal(t, float64(2), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncSkipped.WithLabelValues("1")))
}

// rejectingValidator is a DataSourceRequestValidator that always errors.
type rejectingValidator struct{ err error }

func (r *rejectingValidator) Validate(string, *simplejson.Json, *http.Request) error {
	return r.err
}

func TestSyncExternalAMs_RejectedByValidator(t *testing.T) {
	mimirSrv := startMimirServer(t, "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := &mockAdminConfigStore{}
	adminCfg.On("GetAdminConfigurations").Return([]*ngmodels.AdminConfiguration{
		{OrgID: 1, ExternalAlertmanagerUID: ptrTo("mimir-uid")},
	}, nil)

	rejecting := &rejectingValidator{err: fmt.Errorf("egress denied")}
	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, rejecting)

	moa.syncExternalAMs(context.Background(), []int64{1})

	// Validator rejection short-circuits before the HTTP round-trip and before any save.
	assertNoExtraConfigSaved(t, cs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
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
