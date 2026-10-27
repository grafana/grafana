package notifier_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/remote"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMultiorgAlertmanager_RemoteSecondaryMode(t *testing.T) {
	tenantID := "testTenantID"
	password := "testPassword"

	// Keep the TCP listener and long-lived tracing workers outside the synctest bubble.
	fakeAM := newFakeRemoteAlertmanager(t, tenantID, password)
	testsrv := httptest.NewServer(fakeAM)
	t.Cleanup(testsrv.Close)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	synctest.Test(t, func(t *testing.T) {
		testMultiorgAlertmanagerRemoteSecondaryMode(t, fakeAM, testsrv.URL, secretsService)
	})
}

func testMultiorgAlertmanagerRemoteSecondaryMode(t *testing.T, fakeAM *fakeRemoteAlertmanager, serverURL string, secretsService *secretsManager.SecretsService) { //nolint: staticcheck
	t.Helper()
	ctx := t.Context()
	nopLogger := log.NewNopLogger()
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)

	// We'll start with the default config and no values for silences and notifications.
	kvStore := ngfakes.NewFakeKVStore(t)
	require.NoError(t, kvStore.Set(ctx, 1, "alertmanager", notifier.SilencesFilename, ""))
	require.NoError(t, kvStore.Set(ctx, 1, "alertmanager", notifier.NotificationLogFilename, ""))
	configStore := notifier.NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		1: {
			OrgID:                     1,
			AlertmanagerConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
			CreatedAt:                 time.Now().Unix(),
			Default:                   true,
		},
	})

	// Create the factory function for the MOA using the forked Alertmanager in remote secondary mode.
	remoteAMCfg := remote.AlertmanagerConfig{
		OrgID:             1,
		URL:               serverURL,
		TenantID:          fakeAM.username,
		BasicAuthPassword: fakeAM.password,
		DefaultConfig:     setting.GetAlertmanagerDefaultConfiguration(),
	}
	override := remote.NewRemoteSecondaryFactory(remoteAMCfg,
		kvStore,
		configStore,
		10*time.Second,
		notifier.NewCrypto(secretsService, configStore, log.NewNopLogger()),
		m.GetRemoteAlertmanagerMetrics(),
		tracing.NewNoopTracerService(),
		false,
		featuremgmt.WithFeatures(),
	)

	cfg := &setting.Cfg{
		DataPath: t.TempDir(),
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
		}, // do not poll in tests.
	}
	moa, err := notifier.NewMultiOrgAlertmanager(
		cfg,
		configStore,
		notifier.NewFakeOrgStore(t, []int64{1}),
		kvStore,
		ngfakes.NewFakeProvisioningStore(),
		secretsService.GetDecryptedValue,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		ngfakes.NewFakeReceiverPermissionsService(),
		ngfakes.NewFakeRoutePermissionsService(),
		nopLogger,
		secretsService,
		featuremgmt.WithFeatures(),
		nil,
		false,
		// Sync deps are nil — this test does not enable the sync feature flag.
		notifier.NewExternalAMSyncer(nil, nil, cfg, m.GetMultiOrgAlertmanagerMetrics(), nopLogger, nil, nil, nil),
		notifier.WithAlertmanagerOverride(override),
	)
	require.NoError(t, err)
	syncAlertmanagers := func() {
		require.NoError(t, moa.LoadAndSyncAlertmanagersForOrgs(ctx))
		// Config reloads start workers asynchronously. Let them start before reloading or stopping them.
		synctest.Wait()
	}

	// It should send config and state on startup.
	var lastConfig *remoteClient.UserGrafanaConfig
	var lastState *remoteClient.UserState
	{
		// We should start with no config and no state in the external Alertmanager.
		require.Empty(t, fakeAM.config)
		require.Empty(t, fakeAM.state)

		// On the first sync (startup), both config and state should be updated.
		syncAlertmanagers()
		require.NotEmpty(t, fakeAM.config)
		require.NotEmpty(t, fakeAM.state)
		lastConfig, lastState = fakeAM.config, fakeAM.state
	}

	// It should send config and state on an interval.
	{
		// Let's change the configuration and state.
		require.NoError(t, configStore.SaveAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: validConfig,
			OrgID:                     1,
			LastApplied:               time.Now().Unix(),
		}))
		require.NoError(t, kvStore.Set(ctx, 1, "alertmanager", notifier.SilencesFilename, "lwEKhgEKATISFxIJYWxlcnRuYW1lGgp0ZXN0X2FsZXJ0EiMSDmdyYWZhbmFfZm9sZGVyGhF0ZXN0X2FsZXJ0X2ZvbGRlchoMCN2CkbAGEJbKrMsDIgwI7Z6RsAYQlsqsywMqCwiAkrjDmP7///8BQgxHcmFmYW5hIFRlc3RKDFRlc3QgU2lsZW5jZRIMCO2ekbAGEJbKrMsDlwEKhgEKATESFxIJYWxlcnRuYW1lGgp0ZXN0X2FsZXJ0EiMSDmdyYWZhbmFfZm9sZGVyGhF0ZXN0X2FsZXJ0X2ZvbGRlchoMCN2CkbAGEJbKrMsDIgwI7Z6RsAYQlsqsywMqCwiAkrjDmP7///8BQgxHcmFmYW5hIFRlc3RKDFRlc3QgU2lsZW5jZRIMCO2ekbAGEJbKrMsD"))
		require.NoError(t, kvStore.Set(ctx, 1, "alertmanager", notifier.NotificationLogFilename, "OgoqCgZncm91cDISEgoJcmVjZWl2ZXIyEgV0ZXN0MyoMCLSDkbAGEMvaofYCEgwIxJ+RsAYQy9qh9gI6CioKBmdyb3VwMRISCglyZWNlaXZlcjESBXRlc3QzKgwItIORsAYQy9qh9gISDAjEn5GwBhDL2qH2Ag=="))

		// The sync interval (10s) has not elapsed yet, syncing should have no effect.
		syncAlertmanagers()
		require.Same(t, lastConfig, fakeAM.config)
		require.Same(t, lastState, fakeAM.state)

		// Syncing after the sync interval elapses should update the config, not the state.
		synctest.Sleep(10 * time.Second)
		syncAlertmanagers()
		require.NotSame(t, lastConfig, fakeAM.config)
		require.Same(t, lastState, fakeAM.state)
	}

	// It should send state on shutdown.
	{
		// Let's change the configuration and state again.
		require.NoError(t, configStore.SaveAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
			Default:                   true,
			OrgID:                     1,
			LastApplied:               time.Now().Unix(),
		}))

		// State should be updated when shutting the Alertmanager down.
		syncAlertmanagers()
		moa.StopAndWait()
		require.NotSame(t, lastState, fakeAM.state)
	}
}

func newFakeRemoteAlertmanager(t *testing.T, user, pass string) *fakeRemoteAlertmanager {
	return &fakeRemoteAlertmanager{
		t:        t,
		username: user,
		password: pass,
	}
}

type fakeRemoteAlertmanager struct {
	t        *testing.T
	config   *remoteClient.UserGrafanaConfig
	state    *remoteClient.UserState
	username string
	password string
}

// ServeHTTP handles all routes we need for getting and setting state and config.
func (f *fakeRemoteAlertmanager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Content-Type", "application/json")
	// Idle TCP connections would prevent the synctest bubble from becoming idle.
	w.Header().Set("Connection", "close")

	// Check that basic auth is in place.
	user, pass, ok := r.BasicAuth()
	require.True(f.t, ok)
	require.Equal(f.t, f.username, user)
	require.Equal(f.t, f.password, pass)

	switch r.Method {
	// GET routes
	case http.MethodGet:
		switch r.RequestURI {
		case "/alertmanager/-/ready":
			// Make the readiness check succeed.
			w.WriteHeader(http.StatusOK)
		case "/api/v1/grafana/config":
			f.getConfig(w)
		case "/api/v1/grafana/state":
			f.getState(w)
		default:
			w.WriteHeader(http.StatusNotFound)
		}

	// POST routes
	case http.MethodPost:
		switch r.RequestURI {
		case "/api/v1/grafana/config":
			f.postConfig(w, r)
		case "/api/v1/grafana/state":
			f.postState(w, r)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

type response struct {
	Data   any    `json:"data"`
	Status string `json:"status"`
}

func (f *fakeRemoteAlertmanager) postConfig(w http.ResponseWriter, r *http.Request) {
	var cfg remoteClient.UserGrafanaConfig
	require.NoError(f.t, json.NewDecoder(r.Body).Decode(&cfg))

	f.config = &cfg
	w.WriteHeader(http.StatusCreated)
	require.NoError(f.t, json.NewEncoder(w).Encode(response{Status: "success"}))
}

func (f *fakeRemoteAlertmanager) getConfig(w http.ResponseWriter) {
	res := response{
		Data:   f.config,
		Status: "success",
	}
	require.NoError(f.t, json.NewEncoder(w).Encode(res))
}

func (f *fakeRemoteAlertmanager) postState(w http.ResponseWriter, r *http.Request) {
	var state remoteClient.UserState
	require.NoError(f.t, json.NewDecoder(r.Body).Decode(&state))

	f.state = &state
	w.WriteHeader(http.StatusCreated)
	require.NoError(f.t, json.NewEncoder(w).Encode(response{Status: "success"}))
}

func (f *fakeRemoteAlertmanager) getState(w http.ResponseWriter) {
	res := response{
		Data:   f.state,
		Status: "success",
	}
	require.NoError(f.t, json.NewEncoder(w).Encode(res))
}

var validConfig = `{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"settings": {
					"addresses": "<example@example.com>"
				}
			}]
		}]
	}
}`
