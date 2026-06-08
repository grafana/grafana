package notifier

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

	alertingnotifv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeConfigClient is an in-memory resource.ClientGenerator + resource.Client
// that serves Config objects for the sync tests. It is the UID source: tests
// seed a datasource UID per org via setUID, and the sync worker reads it through
// the typed ConfigClient. Only the read/write paths the worker exercises
// (Get, Create, Update) are meaningful; the rest are inert stubs. Status writes
// (Update) merge into the seeded object so the spec UID survives across ticks.
type fakeConfigClient struct {
	mu       sync.Mutex
	nsMapper request.NamespaceMapper
	objects  map[string]*alertingnotifv0alpha1.Config // namespace -> object
	getErr   map[string]error                         // namespace -> error returned by Get
	getCalls map[string]int                           // namespace -> Get call count
}

func newFakeConfigClient() *fakeConfigClient {
	return &fakeConfigClient{
		nsMapper: func(orgID int64) string { return fmt.Sprintf("org-%d", orgID) },
		objects:  map[string]*alertingnotifv0alpha1.Config{},
		getErr:   map[string]error{},
		getCalls: map[string]int{},
	}
}

// setUID seeds an Config for orgID carrying the given external-sync
// datasource UID. An empty uid seeds a config with no externalSync set, which
// the worker resolves to "" and skips.
func (f *fakeConfigClient) setUID(orgID int64, uid string) {
	obj := &alertingnotifv0alpha1.Config{}
	obj.SetNamespace(f.nsMapper(orgID))
	obj.SetName(alertingnotifv0alpha1.ConfigSingletonName)
	obj.SetResourceVersion("1")
	if uid != "" {
		u := uid
		obj.Spec.ExternalAlertmanagerSync = &alertingnotifv0alpha1.ConfigV0alpha1SpecExternalAlertmanagerSync{DatasourceUid: &u}
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.objects[obj.GetNamespace()] = obj
}

// setErr makes Get for orgID return err (simulating a storage failure).
func (f *fakeConfigClient) setErr(orgID int64, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getErr[f.nsMapper(orgID)] = err
}

// totalGetCalls reports how many Get calls the worker made across all orgs.
func (f *fakeConfigClient) totalGetCalls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, c := range f.getCalls {
		n += c
	}
	return n
}

// resource.ClientGenerator

func (f *fakeConfigClient) ClientFor(resource.Kind) (resource.Client, error) { return f, nil }

func (f *fakeConfigClient) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}
func (f *fakeConfigClient) DiscoveryClient() (resource.DiscoveryClient, error) { return nil, nil }

// resource.Client — only Get/Create/Update (and their *Into variants) are meaningful.

func (f *fakeConfigClient) lookup(ns string) (*alertingnotifv0alpha1.Config, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.getCalls[ns]++
	if err := f.getErr[ns]; err != nil {
		return nil, err
	}
	obj, ok := f.objects[ns]
	if !ok {
		return nil, k8serrors.NewNotFound(alertingnotifv0alpha1.ConfigKind().GroupVersionResource().GroupResource(), alertingnotifv0alpha1.ConfigSingletonName)
	}
	return obj, nil
}

// apply stores obj, merging an incoming status onto any existing object so a
// status write doesn't clobber the seeded spec UID.
func (f *fakeConfigClient) apply(obj resource.Object) resource.Object {
	ac, ok := obj.(*alertingnotifv0alpha1.Config)
	if !ok {
		return obj
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if existing, ok := f.objects[ac.GetNamespace()]; ok {
		merged := *existing
		merged.Status = ac.Status
		f.objects[ac.GetNamespace()] = &merged
		return &merged
	}
	cp := *ac
	f.objects[ac.GetNamespace()] = &cp
	return &cp
}

func (f *fakeConfigClient) Get(_ context.Context, id resource.Identifier) (resource.Object, error) {
	return f.lookup(id.Namespace)
}

func (f *fakeConfigClient) GetInto(_ context.Context, id resource.Identifier, into resource.Object) error {
	obj, err := f.lookup(id.Namespace)
	if err != nil {
		return err
	}
	if t, ok := into.(*alertingnotifv0alpha1.Config); ok {
		*t = *obj
	}
	return nil
}

func (f *fakeConfigClient) Create(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.CreateOptions) (resource.Object, error) {
	return f.apply(obj), nil
}

func (f *fakeConfigClient) CreateInto(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions, _ resource.Object) error {
	_, err := f.Create(ctx, id, obj, opts)
	return err
}

func (f *fakeConfigClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	return f.apply(obj), nil
}

func (f *fakeConfigClient) UpdateInto(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions, _ resource.Object) error {
	_, err := f.Update(ctx, id, obj, opts)
	return err
}

func (f *fakeConfigClient) Patch(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}

func (f *fakeConfigClient) PatchInto(_ context.Context, _ resource.Identifier, _ resource.PatchRequest, _ resource.PatchOptions, _ resource.Object) error {
	return nil
}

func (f *fakeConfigClient) Delete(_ context.Context, _ resource.Identifier, _ resource.DeleteOptions) error {
	return nil
}

func (f *fakeConfigClient) List(_ context.Context, _ string, _ resource.ListOptions) (resource.ListObject, error) {
	return nil, nil
}

func (f *fakeConfigClient) ListInto(_ context.Context, _ string, _ resource.ListOptions, _ resource.ListObject) error {
	return nil
}

func (f *fakeConfigClient) Watch(_ context.Context, _ string, _ resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, nil
}

func (f *fakeConfigClient) SubresourceRequest(_ context.Context, _ resource.Identifier, _ resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
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
	adminCfg *fakeConfigClient,
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

	cfg := &setting.Cfg{
		DataPath: t.TempDir(),
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			ExternalAlertmanagerUID:        operatorUID,
		},
	}
	syncer := NewExternalAMSyncer(dsService, httpclient.NewProvider(), v, cfg, m.GetMultiOrgAlertmanagerMetrics(), log.New("test.external_am_sync"), adminCfg, adminCfg.nsMapper)
	moa, err := NewMultiOrgAlertmanager(
		cfg,
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
		syncer,
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
	adminCfg := newFakeConfigClient()

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, false, "", []int64{1})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// Flag off → FetchExtraConfig short-circuits before any admin-config lookup.
	assert.Equal(t, 0, adminCfg.totalGetCalls())
	assertNoExtraConfigSaved(t, cs, 1)
}

func TestSyncExternalAMs_NoUID_Skipped(t *testing.T) {
	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "")

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "", []int64{1})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	assertNoExtraConfigSaved(t, cs, 1)
}

func TestSyncExternalAMs_DisabledOrgSkipped(t *testing.T) {
	// Org 1 enabled, org 2 disabled. Both have admin config UIDs, but only org 1
	// has its DS registered in the fake DS service. If the syncer respected the
	// disabled-orgs filter, org 2 is skipped entirely (no DS lookup, no failure
	// metric). If it didn't, org 2's DS lookup would fail and bump
	// datasource_lookup on the failures metric.
	mimirSrv := startMimirServer(t, "route:\n  receiver: mimir-receiver\nreceivers:\n  - name: mimir-receiver")

	ds1 := makeMimirDS("uid-1", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds1}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "uid-1")
	adminCfg.setUID(2, "uid-2")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1, 2})
	moa.settings.UnifiedAlerting.DisabledOrgs = map[int64]struct{}{2: {}}

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1, 2})

	// Org 1 succeeded.
	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))

	// Org 2 was skipped: no save, no failure metric.
	assertNoExtraConfigSaved(t, cs, 2)
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("2", "datasource_lookup")))
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("2")))
}

func TestSyncExternalAMs_OperatorUIDOverridesDB(t *testing.T) {
	mimirSrv := startMimirServer(t, "route:\n  receiver: mimir-receiver\nreceivers:\n  - name: mimir-receiver")

	// Operator UID "operator-uid" should win over DB value "db-uid".
	ds := makeMimirDS("operator-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	// Operator UID short-circuits the admin-config lookup; Maybe in case the
	// resolver gets called via a different path during the bootstrap.
	adminCfg.setUID(1, "db-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "operator-uid", []int64{1})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	saved, err := cs.GetLatestAlertmanagerConfiguration(context.Background(), 1)
	require.NoError(t, err)
	cfg, err := Load([]byte(saved.AlertmanagerConfiguration))
	require.NoError(t, err)
	require.Len(t, cfg.ExtraConfigs, 1)
	assert.Equal(t, "operator-uid", cfg.ExtraConfigs[0].Identifier)
}

func TestSyncExternalAMs_GetConfigurationError(t *testing.T) {
	adminCfg := newFakeConfigClient()
	adminCfg.setErr(1, fmt.Errorf("admin config client error"))

	moa, cs := buildSyncTestMOA(t, adminCfg, &dsfakes.FakeDataSourceService{}, true, "", []int64{1})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// Admin-config lookup error → FetchExtraConfig logs and returns (nil, 0); no save.
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

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "ds-1")
	adminCfg.setUID(2, "ds-2")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1, 2})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1, 2})

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

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "slow-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	// Bound the parent context so the request returns quickly via context cancellation
	// rather than the HTTP client's hard 10s timeout.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	moa.SyncAlertmanagersForOrgs(ctx, []int64{1})
	elapsed := time.Since(start)

	assert.Less(t, elapsed, 5*time.Second)
	assertNoExtraConfigSaved(t, cs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
}

func TestSyncExternalAMs_SuccessPath(t *testing.T) {
	const amConfig = "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default"

	mimirSrv := startMimirServer(t, amConfig)

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

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

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	// First tick: stores the config and writes a history row on top of the
	// bootstrap default. Bootstrap counts as one history entry; the first sync
	// adds a second.
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2)
	require.NotZero(t, testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncHash.WithLabelValues("1")), "hash gauge should be set after a successful sync")

	// Second tick on identical Mimir output: stored-config hash matches the
	// incoming hash, so SaveAndApplyExtraConfiguration is not called and no
	// new history row is written. Counts as success — we don't track skipped
	// separately, matching the regular apply loop.
	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2, "no-op sync should not write a new history row")

	assert.Equal(t, float64(2), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")), "both ticks count as success")
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

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 2, "first sync writes one history row on top of bootstrap")
	firstHash := testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncHash.WithLabelValues("1"))
	require.NotZero(t, firstHash)

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})
	require.Len(t, cs.historicConfigs[1], 3, "different response bytes should trigger a new save")

	assert.Equal(t, float64(2), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncTotal.WithLabelValues("1")))
	assert.NotEqual(t, firstHash, testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncHash.WithLabelValues("1")), "hash gauge should change when config changes")
}

func TestSyncExternalAMs_IdentifierMismatchClassifiedOnMetric(t *testing.T) {
	const amConfig = "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default"
	mimirSrv := startMimirServer(t, amConfig)

	// Datasource UID "different-uid" — sync will try to save an ExtraConfig with this
	// identifier, but the org already has an ExtraConfig with "existing-uid", so
	// SaveAndApplyExtraConfiguration with replace=false rejects it.
	ds := makeMimirDS("different-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "different-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	// Seed an existing ExtraConfig with a different identifier so the sync collides.
	seedCtx, seedUser := identity.WithServiceIdentity(context.Background(), 1)
	_, err := moa.SaveAndApplyExtraConfiguration(seedCtx, 1, seedUser, syncBypassAuthz{}, v1.ExtraConfiguration{
		Identifier:         "existing-uid",
		AlertmanagerConfig: amConfig,
	}, false, false, false)
	require.NoError(t, err)
	rowsBefore := len(cs.historicConfigs[1])

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// No new history row — the save was rejected.
	assert.Equal(t, rowsBefore, len(cs.historicConfigs[1]), "identifier collision must not write history")

	// Failure metric tagged with the dedicated reason so operators can alert on it
	// separately from generic save errors.
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "identifier_mismatch")))
	// Generic save reason should NOT be incremented.
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "save")))
}

func TestSyncExternalAMs_NoUpstreamConfigClassifiedOnMetric(t *testing.T) {
	// Mimir responds with an empty alertmanager_config field. The syncer
	// short-circuits in fetchExtraConfig with ReasonNoUpstreamConfig instead
	// of letting the conversion path surface a generic "SaveFailed".
	mimirSrv := startMimirServer(t, "")

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})
	rowsBefore := len(cs.historicConfigs[1])

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// No new history row — the syncer didn't attempt to persist anything.
	assert.Equal(t, rowsBefore, len(cs.historicConfigs[1]), "empty upstream config must not write history")

	// Failure metric tagged with the dedicated reason so operators can alert
	// on a degenerate-but-valid upstream state distinctly from real save errors.
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "no_upstream_config")))
	// Generic save reason should NOT be incremented.
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "save")))
}

func TestSyncExternalAMs_Mimir404ClassifiedAsNoUpstreamConfig(t *testing.T) {
	// Real Mimir returns HTTP 404 (not 200/empty) when no alertmanager_config
	// has ever been stored for the tenant. fetchMimirConfig translates 404 to
	// an empty config so the syncer classifies this as no_upstream_config —
	// not mimir_fetch — matching the design intent that "nothing to import"
	// is a distinct, non-failure outcome from a real fetch error.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "alertmanager storage object not found", http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	ds := makeMimirDS("mimir-uid", 1, srv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})
	rowsBefore := len(cs.historicConfigs[1])

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	assert.Equal(t, rowsBefore, len(cs.historicConfigs[1]), "404 upstream must not write history")
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "no_upstream_config")))
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
}

// rejectingValidator is a DataSourceRequestValidator that always errors.
type rejectingValidator struct{ err error }

func (r *rejectingValidator) Validate(string, map[string]any, *http.Request) error {
	return r.err
}

func TestSyncExternalAMs_RejectedByValidator(t *testing.T) {
	mimirSrv := startMimirServer(t, "route:\n  receiver: mimir-default\nreceivers:\n  - name: mimir-default")

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	rejecting := &rejectingValidator{err: fmt.Errorf("egress denied")}
	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1}, rejecting)

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// Validator rejection short-circuits before the HTTP round-trip and before any save.
	assertNoExtraConfigSaved(t, cs, 1)
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "mimir_fetch")))
}

func TestSyncExternalAMs_InvalidConfigClassifiedOnMetric(t *testing.T) {
	// Upstream config references a filesystem path (auth_password_file) that Grafana
	// cannot represent. It fetches and parses fine but fails validation, so the sync
	// must reject it before saving rather than silently dropping the field.
	const amConfig = `global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'alerts@example.com'
route:
  receiver: a
receivers:
  - name: a
    email_configs:
      - to: someone@example.com
        auth_password_file: /etc/smtp-password
`
	mimirSrv := startMimirServer(t, amConfig)

	ds := makeMimirDS("mimir-uid", 1, mimirSrv.URL)
	dsSvc := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}}

	adminCfg := newFakeConfigClient()
	adminCfg.setUID(1, "mimir-uid")

	moa, cs := buildSyncTestMOA(t, adminCfg, dsSvc, true, "", []int64{1})

	moa.SyncAlertmanagersForOrgs(context.Background(), []int64{1})

	// Invalid config must not be persisted.
	assertNoExtraConfigSaved(t, cs, 1)

	// Failure metric tagged with the dedicated validate reason so operators can alert
	// on it separately from generic save errors.
	assert.Equal(t, float64(1), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "validate")))
	assert.Equal(t, float64(0), testutil.ToFloat64(moa.metrics.ExternalAMConfigSyncFailures.WithLabelValues("1", "save")))
}

func TestBuildMimirConfigURL(t *testing.T) {
	syncer := &ExternalAMSyncer{}

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
			got, err := syncer.buildMimirConfigURL(ds)
			require.NoError(t, err)
			assert.Equal(t, tc.expect, got)
		})
	}
}

// flakyClientGenerator fails ClientFor for the first failN calls, then delegates
// to a working generator — used to exercise resolveCfgClient's retry behavior.
type flakyClientGenerator struct {
	failN    int
	calls    int
	delegate resource.ClientGenerator
}

func (g *flakyClientGenerator) ClientFor(k resource.Kind) (resource.Client, error) {
	g.calls++
	if g.calls <= g.failN {
		return nil, fmt.Errorf("apiserver not ready")
	}
	return g.delegate.ClientFor(k)
}

func (g *flakyClientGenerator) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}
func (g *flakyClientGenerator) DiscoveryClient() (resource.DiscoveryClient, error) { return nil, nil }

func TestResolveCfgClient_RetriesOnFailureAndCachesSuccess(t *testing.T) {
	gen := &flakyClientGenerator{failN: 1, delegate: newFakeConfigClient()}
	s := &ExternalAMSyncer{clientGenerator: gen}

	// First call: the generator errors. The failure must NOT be cached.
	_, err := s.resolveCfgClient()
	require.Error(t, err)
	require.Equal(t, 1, gen.calls)

	// Second call: retries and succeeds.
	c, err := s.resolveCfgClient()
	require.NoError(t, err)
	require.NotNil(t, c)
	require.Equal(t, 2, gen.calls)

	// Third call: returns the cached client without rebuilding.
	c2, err := s.resolveCfgClient()
	require.NoError(t, err)
	require.Same(t, c, c2)
	require.Equal(t, 2, gen.calls, "successful client should be cached")
}
