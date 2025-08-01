package remote

import (
	"context"
	"crypto/md5"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/client_golang/prometheus"
	common_config "github.com/prometheus/common/config"
	"github.com/stretchr/testify/require"

	alertingClusterPB "github.com/grafana/alerting/cluster/clusterpb"
	"github.com/grafana/alerting/definition"
	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/notify"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed test-data/*.*
var testData embed.FS

var (
	defaultGrafanaConfig = setting.GetAlertmanagerDefaultConfiguration()
	errTest              = errors.New("test")
)

const (
	testPassword = "test"

	// Valid Grafana Alertmanager configurations.
	testGrafanaConfig                               = `{"template_files":{},"alertmanager_config":{"time_intervals":[{"name":"weekends","time_intervals":[{"weekdays":["saturday","sunday"],"location":"Africa/Accra"}]}],"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"}}]}]}}`
	testGrafanaConfigWithSecret                     = `{"template_files":{},"alertmanager_config":{"time_intervals":[{"name":"weekends","time_intervals":[{"weekdays":["saturday","sunday"],"location":"Africa/Accra"}]}],"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"dde6ntuob69dtf","name":"WH","type":"webhook","disableResolveMessage":false,"settings":{"url":"http://localhost:8080","username":"test","password":"test"}}]}]}}`
	testGrafanaDefaultConfigWithDifferentFieldOrder = `{"alertmanager_config":{"route":{"group_by":["alertname","grafana_folder"],"receiver":"grafana-default-email"},"receivers":[{"grafana_managed_receiver_configs":[{"uid":"","name":"email receiver","type":"email","settings":{"addresses":"<example@email.com>"}}],"name":"grafana-default-email"}]}}`

	// Valid Alertmanager state base64 encoded.
	testSilence1 = "lwEKhgEKATESFxIJYWxlcnRuYW1lGgp0ZXN0X2FsZXJ0EiMSDmdyYWZhbmFfZm9sZGVyGhF0ZXN0X2FsZXJ0X2ZvbGRlchoMCN2CkbAGEJbKrMsDIgwI7Z6RsAYQlsqsywMqCwiAkrjDmP7///8BQgxHcmFmYW5hIFRlc3RKDFRlc3QgU2lsZW5jZRIMCO2ekbAGEJbKrMsD"
	testSilence2 = "lwEKhgEKATISFxIJYWxlcnRuYW1lGgp0ZXN0X2FsZXJ0EiMSDmdyYWZhbmFfZm9sZGVyGhF0ZXN0X2FsZXJ0X2ZvbGRlchoMCN2CkbAGEJbKrMsDIgwI7Z6RsAYQlsqsywMqCwiAkrjDmP7///8BQgxHcmFmYW5hIFRlc3RKDFRlc3QgU2lsZW5jZRIMCO2ekbAGEJbKrMsDlwEKhgEKATESFxIJYWxlcnRuYW1lGgp0ZXN0X2FsZXJ0EiMSDmdyYWZhbmFfZm9sZGVyGhF0ZXN0X2FsZXJ0X2ZvbGRlchoMCN2CkbAGEJbKrMsDIgwI7Z6RsAYQlsqsywMqCwiAkrjDmP7///8BQgxHcmFmYW5hIFRlc3RKDFRlc3QgU2lsZW5jZRIMCO2ekbAGEJbKrMsD"
	testNflog1   = "OgoqCgZncm91cDESEgoJcmVjZWl2ZXIxEgV0ZXN0MyoMCIzm1bAGEPqx5uEBEgwInILWsAYQ+rHm4QE="
	testNflog2   = "OgoqCgZncm91cDISEgoJcmVjZWl2ZXIyEgV0ZXN0MyoMCLSDkbAGEMvaofYCEgwIxJ+RsAYQy9qh9gI6CioKBmdyb3VwMRISCglyZWNlaXZlcjESBXRlc3QzKgwItIORsAYQy9qh9gISDAjEn5GwBhDL2qH2Ag=="
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestNewAlertmanager(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		tenantID string
		password string
		orgID    int64
		expErr   string
	}{
		{
			name:     "empty URL",
			url:      "",
			tenantID: "1234",
			password: "test",
			orgID:    1,
			expErr:   "empty remote Alertmanager URL for tenant '1234'",
		},
		{
			name:     "invalid URL",
			url:      "asdasd%sasdsd",
			tenantID: "1234",
			password: "test",
			orgID:    1,
			expErr:   "unable to parse remote Alertmanager URL: parse \"asdasd%sasdsd\": invalid URL escape \"%sa\"",
		},
		{
			name:     "valid parameters",
			url:      "http://localhost:8080",
			tenantID: "1234",
			password: "test",
			orgID:    1,
		},
	}

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := AlertmanagerConfig{
				OrgID:             test.orgID,
				URL:               test.url,
				TenantID:          test.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     defaultGrafanaConfig,
			}
			m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
			am, err := NewAlertmanager(context.Background(), cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
			if test.expErr != "" {
				require.EqualError(tt, err, test.expErr)
				return
			}

			require.NoError(tt, err)
			require.Equal(tt, am.tenantID, test.tenantID)
			require.Equal(tt, am.url, test.url)
			require.Equal(tt, am.orgID, test.orgID)
			require.NotNil(tt, am.amClient)
		})
	}
}

func TestGetRemoteState(t *testing.T) {
	const tenantID = "test"
	ctx := context.Background()
	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
	tc := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())

	// getOkHandler allows us to specify a full state the test server is going to respond with.
	getOkHandler := func(state string) http.HandlerFunc {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
			require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))

			res := map[string]any{
				"status": "success",
				"data": map[string]any{
					"state": state,
				},
			}
			w.Header().Add("content-type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(res))
		})
	}

	// errorHandler makes the test server return a 500 status code and a non-JSON response.
	errorHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("content-type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
	})

	// Test full states:
	// - One with unknown part keys
	// - One with the expected part keys
	badState := alertingClusterPB.FullState{
		Parts: []alertingClusterPB.Part{
			{Key: "unknown", Data: []byte("data")},
		},
	}
	rawBadState, err := badState.Marshal()
	require.NoError(t, err)

	state := alertingClusterPB.FullState{
		Parts: []alertingClusterPB.Part{
			{Key: "nfl:test", Data: []byte("test-nflog")},
			{Key: "sil:test", Data: []byte("test-silences")},
		},
	}
	rawState, err := state.Marshal()
	require.NoError(t, err)

	tests := []struct {
		name        string
		handler     http.Handler
		expNflog    []byte
		expSilences []byte
		expErr      string
	}{
		{
			name:    "non base64-encoded state",
			handler: getOkHandler("invalid state"),
			expErr:  "failed to base64-decode remote state: illegal base64 data at input byte 7",
		},
		{
			name:    "error from the Mimir API",
			handler: errorHandler,
			expErr:  "failed to pull remote state: Response content-type is not application/json: text/html; charset=utf-8",
		},
		{
			name:    "invalid state, base64-encoded",
			handler: getOkHandler(base64.StdEncoding.EncodeToString([]byte("invalid state"))),
			expErr:  "failed to unmarshal remote state: proto: FullState: wiretype end group for non-group",
		},
		{
			name:    "unknown part key",
			handler: getOkHandler(base64.StdEncoding.EncodeToString(rawBadState)),
			expErr:  "unknown part key \"unknown\"",
		},
		{
			name:        "success",
			handler:     getOkHandler(base64.StdEncoding.EncodeToString(rawState)),
			expNflog:    []byte("test-nflog"),
			expSilences: []byte("test-silences"),
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			server := httptest.NewServer(test.handler)
			cfg := AlertmanagerConfig{
				OrgID:         1,
				TenantID:      tenantID,
				URL:           server.URL,
				DefaultConfig: defaultGrafanaConfig,
			}
			am, err := NewAlertmanager(ctx,
				cfg,
				fstore,
				tc,
				NoopAutogenFn,
				m,
				tracing.InitializeTracerForTest(),
			)
			require.NoError(t, err)

			s, err := am.GetRemoteState(ctx)
			if test.expErr != "" {
				require.Error(t, err)
				require.Equal(t, test.expErr, err.Error())
				return
			}

			require.NoError(t, err)
			require.Equal(t, test.expNflog, s.Nflog)
			require.Equal(t, test.expSilences, s.Silences)
		})
	}
}

func TestIntegrationApplyConfig(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")

		// errorHandler returns an error response for the readiness check and state sync.
	}
	const tenantID = "test"

	errorHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))
		w.Header().Add("content-type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"status": "error"}))
	})

	var configSent client.UserGrafanaConfig
	var configSyncs, stateSyncs int
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))
		res := map[string]any{"status": "success"}

		if r.Method == http.MethodPost {
			if strings.Contains(r.URL.Path, "/config") {
				var cfg client.UserGrafanaConfig
				require.NoError(t, json.NewDecoder(r.Body).Decode(&cfg))
				configSent = cfg
				configSyncs++
			} else {
				stateSyncs++
			}
		} else {
			res["data"] = &configSent
		}
		w.Header().Add("content-type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(res))
	})

	// Encrypt receivers to save secrets in the database.
	var c apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithSecret), &c))
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
	encryptedReceivers, err := legacy_storage.EncryptedReceivers(c.AlertmanagerConfig.Receivers, func(payload string) (string, error) {
		encrypted, err := secretsService.Encrypt(context.Background(), []byte(payload), secrets.WithoutScope())
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(encrypted), nil
	})
	c.AlertmanagerConfig.Receivers = encryptedReceivers
	require.NoError(t, err)

	// The encrypted configuration should be different than the one we will send.
	encryptedConfig, err := json.Marshal(c)
	require.NoError(t, err)
	require.NotEqual(t, testGrafanaConfigWithSecret, encryptedConfig)

	// ApplyConfig performs a readiness check at startup.
	// A non-200 response should result in an error.
	server := httptest.NewServer(errorHandler)
	cfg := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
		PromoteConfig: true,
		SyncInterval:  1 * time.Hour,
		ExternalURL:   "https://test.grafana.com",
		SmtpConfig: client.SmtpConfig{
			FromAddress:   "test-instance@grafana.net",
			StaticHeaders: map[string]string{"Header-1": "Value-1", "Header-2": "Value-2"},
		},
	}

	ctx := context.Background()
	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, testSilence1))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, testNflog1))

	// An error response from the remote Alertmanager should result in the readiness check failing.
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	config := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: string(encryptedConfig),
	}
	require.Error(t, am.ApplyConfig(ctx, config))
	require.False(t, am.Ready())
	require.Equal(t, 0, stateSyncs)
	require.Equal(t, 0, configSyncs)

	// A 200 status code response should make the check succeed.
	server.Config.Handler = okHandler
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.True(t, am.Ready())
	require.Equal(t, 1, stateSyncs)
	require.Equal(t, 1, configSyncs)

	// The sent configuration should be unencrypted and promoted.
	amCfg, err := json.Marshal(configSent.GrafanaAlertmanagerConfig)
	require.NoError(t, err)
	require.JSONEq(t, testGrafanaConfigWithSecret, string(amCfg))
	require.True(t, configSent.Promoted)

	// Grafana's URL, email "from" address, and static headers should be sent alongside the configuration.
	require.Equal(t, cfg.ExternalURL, configSent.ExternalURL)
	require.Equal(t, cfg.SmtpConfig.FromAddress, configSent.SmtpConfig.FromAddress)
	require.Equal(t, cfg.SmtpConfig.StaticHeaders, configSent.SmtpConfig.StaticHeaders)

	// If we already got a 200 status code response and the sync interval hasn't elapsed,
	// we shouldn't send the state/configuration again.
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 1, stateSyncs)
	require.Equal(t, 1, configSyncs)

	// Changing the sync interval and calling ApplyConfig again with a new config
	// should result in us sending the configuration but not the state.
	am.syncInterval = 0
	config = &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: string(testGrafanaConfig),
	}
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 2, configSyncs)
	require.Equal(t, 1, stateSyncs)

	// After a restart, the Alertmanager shouldn't send the configuration if it has not changed.
	am, err = NewAlertmanager(context.Background(), cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 2, configSyncs)

	// Changing the "from" address should result in the configuration being updated.
	cfg.SmtpConfig.FromAddress = "new-address@test.com"
	am, err = NewAlertmanager(context.Background(), cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 3, configSyncs)
	require.Equal(t, am.smtp.FromAddress, configSent.SmtpConfig.FromAddress)

	// Changing fields in the SMTP config should result in the configuration being updated.
	cfg.SmtpConfig = client.SmtpConfig{
		EhloIdentity:   "test",
		FromAddress:    "test@test.com",
		FromName:       "Test Name",
		Host:           "test:25",
		Password:       "test",
		SkipVerify:     true,
		StartTLSPolicy: "test",
		StaticHeaders:  map[string]string{"test": "true"},
		User:           "Test User",
	}
	am, err = NewAlertmanager(context.Background(), cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 4, configSyncs)
	require.Equal(t, am.smtp, configSent.SmtpConfig)

	// Failing to add the auto-generated routes should not result in an error.
	_, err = NewAlertmanager(context.Background(), cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), errAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err, errTest)
}

func TestCompareAndSendConfiguration(t *testing.T) {
	const tenantID = "test"
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	testCrypto := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())

	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))
		w.Header().Add("content-type", "application/json")

		b, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, r.Body.Close())
		got = string(b)

		_, err = w.Write([]byte(`{"status": "success"}`))
		require.NoError(t, err)
	}))

	fstore := notifier.NewFileStore(1, ngfakes.NewFakeKVStore(t))
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	cfg := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
	}

	testAutogenFn := func(_ context.Context, _ log.Logger, _ int64, config *apimodels.PostableApiAlertingConfig, _ bool) error {
		newRoute := definition.Route{
			Receiver: config.Receivers[0].Name,
			Match:    map[string]string{"auto-gen-test": "true"},
		}

		config.Route.Routes = append(config.Route.Routes, &newRoute)
		return nil
	}

	// Create a config with correctly encrypted and encoded secrets.
	var inputCfg apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithSecret), &inputCfg))
	encryptedReceivers, err := legacy_storage.EncryptedReceivers(inputCfg.AlertmanagerConfig.Receivers, func(payload string) (string, error) {
		encrypted, err := secretsService.Encrypt(context.Background(), []byte(payload), secrets.WithoutScope())
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(encrypted), nil
	})
	inputCfg.AlertmanagerConfig.Receivers = encryptedReceivers
	require.NoError(t, err)
	testGrafanaConfigWithEncryptedSecret, err := json.Marshal(inputCfg)
	require.NoError(t, err)

	// Created a config with invalid base64 encoding in the secret.
	inputCfg.AlertmanagerConfig.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].SecureSettings["password"] = "!"
	testGrafanaConfigWithBadEncoding, err := json.Marshal(inputCfg)
	require.NoError(t, err)

	// Create a config with a valid base64 encoding but an invalid encryption.
	inputCfg.AlertmanagerConfig.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].SecureSettings["password"] = base64.StdEncoding.EncodeToString([]byte("test"))
	testGrafanaConfigWithBadEncryption, err := json.Marshal(inputCfg)
	require.NoError(t, err)

	test, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
	require.NoError(t, err)
	cfgWithDecryptedSecret := client.GrafanaAlertmanagerConfig{
		TemplateFiles:      test.TemplateFiles,
		AlertmanagerConfig: test.AlertmanagerConfig,
	}

	testAutogenRoutes, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
	require.NoError(t, err)
	require.NoError(t, testAutogenFn(nil, nil, 0, &testAutogenRoutes.AlertmanagerConfig, false))
	cfgWithAutogenRoutes := client.GrafanaAlertmanagerConfig{
		TemplateFiles:      testAutogenRoutes.TemplateFiles,
		AlertmanagerConfig: testAutogenRoutes.AlertmanagerConfig,
	}

	cfgWithExtraUnmergedBytes, err := testData.ReadFile(path.Join("test-data", "config-with-extra.json"))
	require.NoError(t, err)
	cfgWithExtraUnmerged, err := notifier.Load(cfgWithExtraUnmergedBytes)
	require.NoError(t, err)
	r, err := cfgWithExtraUnmerged.GetMergedAlertmanagerConfig()
	require.NoError(t, err)
	cfgWithExtraMerged := client.GrafanaAlertmanagerConfig{
		TemplateFiles:      cfgWithExtraUnmerged.TemplateFiles,
		AlertmanagerConfig: r.Config,
		Templates:          definition.TemplatesMapToPostableAPITemplates(cfgWithExtraUnmerged.ExtraConfigs[0].TemplateFiles, definition.MimirTemplateKind),
	}

	tests := []struct {
		name           string
		config         string
		autogenFn      AutogenFn
		expCfg         *client.UserGrafanaConfig
		expErrContains []string
	}{
		{
			"invalid config",
			"{}",
			NoopAutogenFn,
			nil,
			[]string{"no route provided in config"},
		},
		{
			"invalid base-64 in key",
			string(testGrafanaConfigWithBadEncoding),
			NoopAutogenFn,
			nil,
			[]string{`"grafana-default-email"`, "dde6ntuob69dtf", "password", "illegal base64 data at input byte 0"},
		},
		{
			"decrypt error",
			string(testGrafanaConfigWithBadEncryption),
			NoopAutogenFn,
			nil,
			[]string{`"grafana-default-email"`, "dde6ntuob69dtf", "password", "unable to compute salt"},
		},
		{
			"error from autogen function",
			string(testGrafanaConfigWithEncryptedSecret),
			errAutogenFn,
			nil,
			[]string{errTest.Error()},
		},
		{
			"no error",
			string(testGrafanaConfigWithEncryptedSecret),
			NoopAutogenFn,
			&client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithDecryptedSecret,
			},
			nil,
		},
		{
			"no error, with auto-generated routes",
			string(testGrafanaConfigWithEncryptedSecret),
			testAutogenFn,
			&client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithAutogenRoutes,
			},
			nil,
		},
		{
			name:      "no error, with extra configurations",
			config:    string(cfgWithExtraUnmergedBytes),
			autogenFn: NoopAutogenFn,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithExtraMerged,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			ctx := context.Background()
			am, err := NewAlertmanager(ctx,
				cfg,
				fstore,
				testCrypto,
				NoopAutogenFn,
				m,
				tracing.InitializeTracerForTest(),
			)
			require.NoError(t, err)

			// Adding the autogenFn after creating the Alertmanager
			// to simulate errors when comparing the configuration.
			am.autogenFn = test.autogenFn

			cfg := ngmodels.AlertConfiguration{
				AlertmanagerConfiguration: test.config,
			}
			err = am.CompareAndSendConfiguration(ctx, &cfg)
			if len(test.expErrContains) == 0 {
				require.NoError(tt, err)

				var gotCfg client.UserGrafanaConfig
				require.NoError(tt, json.Unmarshal([]byte(got), &gotCfg))

				require.NotEmpty(tt, gotCfg.Hash)
				require.Empty(tt, cmp.Diff(test.expCfg, &gotCfg,
					cmpopts.IgnoreFields(client.UserGrafanaConfig{}, "Hash"), // do not compare hashes because the config is processed slightly different: empty maps are nils.
					cmpopts.EquateEmpty(),
					cmpopts.IgnoreUnexported(
						time.Location{},
						labels.Matcher{},
						common_config.ProxyConfig{})))

				got1 := got
				got = ""
				err = am.CompareAndSendConfiguration(ctx, &cfg)
				require.NoError(tt, err)

				got2 := got
				require.Equalf(tt, got1, got2, "Configuration is not idempotent")
				return
			}
			for _, expErr := range test.expErrContains {
				require.ErrorContains(tt, err, expErr)
			}
		})
	}
}

func Test_TestReceiversDecryptsSecureSettings(t *testing.T) {
	const tenantID = "test"
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	testCrypto := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())

	var got apimodels.TestReceiversConfigBodyParams
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))
		w.Header().Add("Content-Type", "application/json")
		require.NoError(t, json.NewDecoder(r.Body).Decode(&got))
		require.NoError(t, r.Body.Close())
		_, err := w.Write([]byte(`{"status": "success"}`))
		require.NoError(t, err)
	}))

	fstore := notifier.NewFileStore(1, ngfakes.NewFakeKVStore(t))
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	cfg := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
	}

	am, err := NewAlertmanager(context.Background(),
		cfg,
		fstore,
		testCrypto,
		NoopAutogenFn,
		m,
		tracing.InitializeTracerForTest(),
	)
	require.NoError(t, err)

	var inputCfg apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithSecret), &inputCfg))
	encryptedReceivers, err := legacy_storage.EncryptedReceivers(inputCfg.AlertmanagerConfig.Receivers, func(payload string) (string, error) {
		encrypted, err := secretsService.Encrypt(context.Background(), []byte(payload), secrets.WithoutScope())
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(encrypted), nil
	})
	inputCfg.AlertmanagerConfig.Receivers = encryptedReceivers
	require.NoError(t, err)

	params := apimodels.TestReceiversConfigBodyParams{
		Alert:     &apimodels.TestReceiversConfigAlertParams{},
		Receivers: inputCfg.AlertmanagerConfig.Receivers,
	}

	_, _, err = am.TestReceivers(context.Background(), params)
	require.NoError(t, err)

	expectedSettings, err := json.Marshal(map[string]any{
		"url":      "http://localhost:8080",
		"username": "test",
		"password": testPassword,
	})
	require.NoError(t, err)
	require.EqualValues(t, expectedSettings, got.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].Settings)
}

func Test_isDefaultConfiguration(t *testing.T) {
	parsedDefaultConfig, _ := notifier.Load([]byte(defaultGrafanaConfig))
	parsedTestConfig, _ := notifier.Load([]byte(testGrafanaConfig))
	parsedDefaultConfigWithDifferentFieldOrder, _ := notifier.Load([]byte(testGrafanaDefaultConfigWithDifferentFieldOrder))
	rawDefaultCfg, _ := json.Marshal(parsedDefaultConfig)

	tests := []struct {
		name     string
		config   *apimodels.PostableUserConfig
		expected bool
	}{
		{
			"empty configuration",
			nil,
			false,
		},
		{
			"valid configuration",
			parsedTestConfig,
			false,
		},
		{
			"default configuration",
			parsedDefaultConfig,
			true,
		},
		{
			"default configuration with different field order",
			parsedDefaultConfigWithDifferentFieldOrder,
			false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			am := &Alertmanager{
				defaultConfig:     string(rawDefaultCfg),
				defaultConfigHash: fmt.Sprintf("%x", md5.Sum(rawDefaultCfg)),
			}
			raw, err := json.Marshal(test.config)
			require.NoError(tt, err)
			require.Equal(tt, test.expected, am.isDefaultConfiguration(fmt.Sprintf("%x", md5.Sum(raw))))
		})
	}
}

func TestApplyConfigWithExtraConfigs(t *testing.T) {
	const tenantID = "test"

	var configSent client.UserGrafanaConfig
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))

		if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/config") {
			require.NoError(t, json.NewDecoder(r.Body).Decode(&configSent))
		}

		w.Header().Add("content-type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"status": "success"}))
	}))
	defer server.Close()

	var cfg apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfig), &cfg))

	cfg.ExtraConfigs = []apimodels.ExtraConfiguration{
		{
			Identifier: "test-external",
			MergeMatchers: []*labels.Matcher{
				{
					Type:  labels.MatchEqual,
					Name:  "test",
					Value: "value",
				},
			},
			TemplateFiles: map[string]string{},
			AlertmanagerConfig: `global:
  smtp_smarthost: localhost:587
  smtp_from: alerts@grafana.com
route:
  receiver: extra-receiver
receivers:
  - name: extra-receiver
    email_configs:
      - to: alerts@grafana.com`,
		},
	}

	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
	tc := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())
	ctx := context.Background()

	c := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
		PromoteConfig: true,
	}

	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	require.NoError(t, store.Set(ctx, c.OrgID, "alertmanager", notifier.SilencesFilename, ""))
	require.NoError(t, store.Set(ctx, c.OrgID, "alertmanager", notifier.NotificationLogFilename, ""))

	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, c, fstore, tc, NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	err = am.SaveAndApplyConfig(ctx, &cfg)
	require.NoError(t, err)

	require.Equal(t, len(configSent.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers), 2)

	var extraReceiver *apimodels.PostableApiReceiver
	for _, rcv := range configSent.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers {
		if rcv.Name == "extra-receiver" {
			extraReceiver = rcv
			break
		}
	}
	require.NotNil(t, extraReceiver)
	require.Len(t, extraReceiver.EmailConfigs, 1)
	require.Equal(t, "alerts@grafana.com", extraReceiver.EmailConfigs[0].To)
	require.NotEmpty(t, configSent.Hash)
}

func TestCompareAndSendConfigurationWithExtraConfigs(t *testing.T) {
	const tenantID = "test"

	var configSent client.UserGrafanaConfig
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		require.Equal(t, "true", r.Header.Get(client.RemoteAlertmanagerHeader))

		if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/config") {
			require.NoError(t, json.NewDecoder(r.Body).Decode(&configSent))
		} else if r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/config") {
			// If this is a GET method, Grafana requests the current configuration to compare.
			// Return an empty config to ensure it gets replaced
			w.Header().Add("content-type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: client.GrafanaAlertmanagerConfig{},
			}))
			return
		}

		w.Header().Add("content-type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"status": "success"}))
	}))
	defer server.Close()

	cfg := apimodels.PostableUserConfig{
		AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
			Config: apimodels.Config{
				Route: &apimodels.Route{
					Receiver: "grafana-default-email",
				},
			},
			Receivers: []*apimodels.PostableApiReceiver{
				{
					Receiver: config.Receiver{Name: "grafana-default-email"},
					PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
							{
								Name:     "email receiver",
								Type:     "email",
								Settings: apimodels.RawMessage(`{"addresses":"<example@email.com>"}`),
							},
						},
					},
				},
			},
		},
		ExtraConfigs: []apimodels.ExtraConfiguration{
			{
				Identifier: "test-external",
				MergeMatchers: []*labels.Matcher{
					{
						Type:  labels.MatchEqual,
						Name:  "test",
						Value: "test",
					},
				},
				AlertmanagerConfig: `global:
  smtp_smarthost: localhost:587
  smtp_from: alerts@grafana.com
route:
  receiver: extra-receiver
receivers:
  - name: extra-receiver
    email_configs:
      - to: alerts@grafana.com`,
			},
		},
	}

	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
	tc := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())
	ctx := context.Background()

	// Encrypt extra configs since this tests the database path
	err := tc.EncryptExtraConfigs(ctx, &cfg)
	require.NoError(t, err)

	c := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
		PromoteConfig: true,
	}

	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	require.NoError(t, store.Set(ctx, c.OrgID, "alertmanager", notifier.SilencesFilename, ""))
	require.NoError(t, store.Set(ctx, c.OrgID, "alertmanager", notifier.NotificationLogFilename, ""))

	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, c, fstore, tc, NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	configJSON, err := json.Marshal(cfg)
	require.NoError(t, err)
	config := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: string(configJSON),
	}

	err = am.CompareAndSendConfiguration(ctx, config)
	require.NoError(t, err)

	require.Equal(t, len(configSent.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers), 2)
	found := slices.ContainsFunc(configSent.GrafanaAlertmanagerConfig.AlertmanagerConfig.Receivers, func(rcv *apimodels.PostableApiReceiver) bool {
		return strings.Contains(rcv.Name, "extra-receiver")
	})
	require.True(t, found)

	// Verify the config hash
	require.NotEmpty(t, configSent.Hash)
}

func TestIntegrationRemoteAlertmanagerConfiguration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}
	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	// ApplyConfig performs a readiness check.
	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	testConfigCreatedAt := time.Now().Unix()
	testConfig := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: testGrafanaConfig,
		ConfigurationHash:         "",
		ConfigurationVersion:      "v2",
		CreatedAt:                 testConfigCreatedAt,
		OrgID:                     1,
	}

	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(cfg.OrgID, store)

	ctx := context.Background()
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, testSilence1))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, testNflog1))

	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, fstore, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	encodedFullState, err := am.getFullState(ctx)
	require.NoError(t, err)

	// We should have no configuration or state at first.
	{
		_, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.Error(t, err)
		require.Equal(t, "Error response from the Mimir API: alertmanager storage object not found", err.Error())

		_, err = am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.Error(t, err)
		require.Equal(t, "Error response from the Mimir API: alertmanager storage object not found", err.Error())
	}

	// Using `ApplyConfig` as a heuristic of a function that gets called when the Alertmanager starts
	// We call it as if the Alertmanager were starting.
	{
		require.NoError(t, am.ApplyConfig(ctx, testConfig))

		// First, we need to verify that the readiness check passes.
		require.True(t, am.Ready())

		// Next, we need to verify that Mimir received both the configuration and state.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		rawCfg, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)
		require.JSONEq(t, testGrafanaConfig, string(rawCfg))
		require.Equal(t, testConfigCreatedAt, config.CreatedAt)
		require.Equal(t, testConfig.Default, config.Default)

		state, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.NoError(t, err)
		require.Equal(t, encodedFullState, state.State)
	}

	// Calling `ApplyConfig` again with a changed configuration and state yields no effect.
	{
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "silences", testSilence2))
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "notifications", testNflog2))
		testConfig.CreatedAt = time.Now().Unix()
		require.NoError(t, am.ApplyConfig(ctx, testConfig))

		// The remote Alertmanager continues to be ready.
		require.True(t, am.Ready())

		// Next, we need to verify that the config that was uploaded remains the same.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		rawCfg, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)
		require.JSONEq(t, testGrafanaConfig, string(rawCfg))
		require.Equal(t, testConfigCreatedAt, config.CreatedAt)
		require.False(t, config.Default)

		// Check that the state is the same as before.
		state, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.NoError(t, err)
		require.Equal(t, encodedFullState, state.State)
	}

	// `SaveAndApplyConfig` is called whenever a user manually changes the Alertmanager configuration.
	// Calling this method should decrypt and send a configuration to the remote Alertmanager.
	{
		postableCfg, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
		require.NoError(t, err)
		encryptedReceivers, err := legacy_storage.EncryptedReceivers(postableCfg.AlertmanagerConfig.Receivers, func(payload string) (string, error) {
			encrypted, err := secretsService.Encrypt(context.Background(), []byte(payload), secrets.WithoutScope())
			if err != nil {
				return "", err
			}
			return base64.StdEncoding.EncodeToString(encrypted), nil
		})
		postableCfg.AlertmanagerConfig.Receivers = encryptedReceivers
		require.NoError(t, err)

		// The encrypted configuration should be different than the one we will send.
		encryptedConfig, err := json.Marshal(postableCfg)
		require.NoError(t, err)
		require.NotEqual(t, testGrafanaConfigWithSecret, encryptedConfig)

		// Call `SaveAndApplyConfig` with the encrypted configuration.
		require.NoError(t, err)
		require.NoError(t, am.SaveAndApplyConfig(ctx, postableCfg))

		// Check that the original configuration is not modified (decrypted).
		currentJSON, err := json.Marshal(postableCfg)
		require.NoError(t, err)
		require.JSONEq(t, string(encryptedConfig), string(currentJSON), "Original configuration should not be modified")

		// Check that the configuration was uploaded to the remote Alertmanager.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)
		got, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)

		require.JSONEq(t, testGrafanaConfigWithSecret, string(got))

		require.False(t, config.Default)

		// An error while adding auto-generated rutes should be returned.
		am.autogenFn = errAutogenFn
		require.ErrorIs(t, am.SaveAndApplyConfig(ctx, postableCfg), errTest)
		am.autogenFn = NoopAutogenFn
	}

	// `SaveAndApplyDefaultConfig` should send the default Alertmanager configuration to the remote Alertmanager.
	{
		require.NoError(t, am.SaveAndApplyDefaultConfig(ctx))

		// Check that the default configuration was uploaded.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		pCfg, err := notifier.Load([]byte(defaultGrafanaConfig))
		require.NoError(t, err)

		want, err := json.Marshal(pCfg)
		require.NoError(t, err)

		got, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)

		require.JSONEq(t, string(want), string(got))
		require.True(t, config.Default)

		// An error while adding auto-generated rutes should be returned.
		am.autogenFn = errAutogenFn
		require.ErrorIs(t, am.SaveAndApplyDefaultConfig(ctx), errTest)
		am.autogenFn = NoopAutogenFn
	}

	// TODO: Now, shutdown the Alertmanager and we expect the latest configuration to be uploaded.
	{
	}
}

func TestIntegrationRemoteAlertmanagerGetStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}
	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	ctx := context.Background()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	// We should get the default Cloud Alertmanager configuration.
	status, err := am.GetStatus(ctx)
	require.NoError(t, err)
	b, err := yaml.Marshal(status.Config)
	require.NoError(t, err)
	require.YAMLEq(t, defaultCloudAMConfig, string(b))
}

func TestIntegrationRemoteAlertmanagerSilences(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}
	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	ctx := context.Background()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	// We should have no silences at first.
	silences, err := am.ListSilences(ctx, []string{})
	require.NoError(t, err)
	require.Equal(t, 0, len(silences))

	// Creating a silence should succeed.
	gen := ngmodels.SilenceGen(ngmodels.SilenceMuts.WithEmptyId())
	testSilence := notifier.SilenceToPostableSilence(gen())
	id, err := am.CreateSilence(ctx, testSilence)
	require.NoError(t, err)
	require.NotEmpty(t, id)
	testSilence.ID = id

	// We should be able to retrieve a specific silence.
	silence, err := am.GetSilence(ctx, testSilence.ID)
	require.NoError(t, err)
	require.Equal(t, testSilence.ID, *silence.ID)

	// Trying to retrieve a non-existing silence should fail.
	_, err = am.GetSilence(ctx, util.GenerateShortUID())
	require.Error(t, err)

	// After creating another silence, the total amount should be 2.
	testSilence2 := notifier.SilenceToPostableSilence(gen())
	id, err = am.CreateSilence(ctx, testSilence2)
	require.NoError(t, err)
	require.NotEmpty(t, id)
	testSilence2.ID = id

	silences, err = am.ListSilences(ctx, []string{})
	require.NoError(t, err)
	require.Equal(t, 2, len(silences))
	require.True(t, *silences[0].ID == testSilence.ID || *silences[0].ID == testSilence2.ID)
	require.True(t, *silences[1].ID == testSilence.ID || *silences[1].ID == testSilence2.ID)

	// After deleting one of those silences, the total amount should be 2 but one of those should be expired.
	err = am.DeleteSilence(ctx, testSilence.ID)
	require.NoError(t, err)

	silences, err = am.ListSilences(ctx, []string{})
	require.NoError(t, err)

	for _, s := range silences {
		if *s.ID == testSilence.ID {
			require.Equal(t, *s.Status.State, "expired")
		} else {
			require.Equal(t, *s.Status.State, "active")
		}
	}

	// When deleting the other silence, both should be expired.
	err = am.DeleteSilence(ctx, testSilence2.ID)
	require.NoError(t, err)

	silences, err = am.ListSilences(ctx, []string{})
	require.NoError(t, err)
	require.Equal(t, *silences[0].Status.State, "expired")
	require.Equal(t, *silences[1].Status.State, "expired")
}

func TestIntegrationRemoteAlertmanagerAlerts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}
	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	ctx := context.Background()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	// Wait until the Alertmanager is ready to send alerts.
	require.NoError(t, am.checkReadiness(ctx))
	require.True(t, am.Ready())
	require.Eventually(t, func() bool {
		return len(am.sender.Alertmanagers()) > 0
	}, 10*time.Second, 500*time.Millisecond)

	// We should have no alerts and no groups at first.
	alerts, err := am.GetAlerts(ctx, true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 0, len(alerts))

	alertGroups, err := am.GetAlertGroups(ctx, true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 0, len(alertGroups))

	// Let's create two active alerts and one expired one.
	// UTF-8 label names should be preserved.
	utf8LabelName := "test utf-8 label 😳"
	alert1 := genAlert(true, map[string]string{utf8LabelName: "test_1", "empty": "", alertingModels.NamespaceUIDLabel: "test_1"})
	alert2 := genAlert(true, map[string]string{utf8LabelName: "test_2", "empty": "", alertingModels.NamespaceUIDLabel: "test_2"})
	alert3 := genAlert(false, map[string]string{utf8LabelName: "test_3", "empty": "", alertingModels.NamespaceUIDLabel: "test_3"})
	postableAlerts := apimodels.PostableAlerts{
		PostableAlerts: []amv2.PostableAlert{alert1, alert2, alert3},
	}
	err = am.PutAlerts(ctx, postableAlerts)
	require.NoError(t, err)

	// We should eventually have two active alerts.
	require.Eventually(t, func() bool {
		alerts, err = am.GetAlerts(ctx, true, true, true, []string{}, "")
		require.NoError(t, err)
		return len(alerts) == 2
	}, 16*time.Second, 1*time.Second)

	alertGroups, err = am.GetAlertGroups(ctx, true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 1, len(alertGroups))

	// Labels with empty values and the namespace UID label should be removed.
	// UTF-8 label names should remain unchanged.
	for _, a := range alertGroups {
		require.Len(t, a.Alerts, 2)
		for _, a := range a.Alerts {
			require.NotContains(t, a.Labels, "empty")
			require.NotContains(t, a.Labels, alertingModels.NamespaceUIDLabel)
			require.Contains(t, a.Labels, utf8LabelName)
		}
	}
}

func TestIntegrationRemoteAlertmanagerReceivers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}

	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	ctx := context.Background()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	// We should start with the default config.
	rcvs, err := am.GetReceivers(ctx)
	require.NoError(t, err)
	require.Equal(t, []apimodels.Receiver{
		{
			Active:       true,
			Name:         "empty-receiver",
			Integrations: []apimodels.Integration{},
		},
	}, rcvs)
}

func TestIntegrationRemoteAlertmanagerTestTemplates(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	amURL, ok := os.LookupEnv("AM_URL")
	if !ok {
		t.Skip("No Alertmanager URL provided")
	}

	tenantID := os.Getenv("AM_TENANT_ID")
	password := os.Getenv("AM_PASSWORD")

	cfg := AlertmanagerConfig{
		OrgID:             1,
		URL:               amURL,
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     defaultGrafanaConfig,
	}

	ctx := context.Background()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, nil, notifier.NewCrypto(secretsService, nil, log.NewNopLogger()), NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)

	// Valid template
	c := apimodels.TestTemplatesConfigBodyParams{
		Alerts: []*amv2.PostableAlert{
			{
				Annotations: amv2.LabelSet{
					"annotations_label": "annotations_value",
				},
				Alert: amv2.Alert{
					Labels: amv2.LabelSet{
						"labels_label:": "labels_value",
					},
				},
			},
		},
		Template: `{{ define "test" }} {{ index .Alerts 0 }} {{ end }}`,
		Name:     "test",
	}
	res, err := am.TestTemplate(ctx, c)

	require.NoError(t, err)
	require.Len(t, res.Errors, 0)
	require.Len(t, res.Results, 1)
	require.Equal(t, "test", res.Results[0].Name)

	// Invalid template
	c.Template = `{{ define "test" }} {{ index 0 .Alerts }} {{ end }}`
	res, err = am.TestTemplate(ctx, c)

	require.NoError(t, err)
	require.Len(t, res.Results, 0)
	require.Len(t, res.Errors, 1)
	require.Equal(t, notify.ExecutionError, res.Errors[0].Kind)
}

func genAlert(active bool, labels map[string]string) amv2.PostableAlert {
	endsAt := time.Now()
	if active {
		endsAt = time.Now().Add(1 * time.Minute)
	}

	return amv2.PostableAlert{
		Annotations: map[string]string{"test_annotation": "test_annotation_value"},
		StartsAt:    strfmt.DateTime(time.Now()),
		EndsAt:      strfmt.DateTime(endsAt),
		Alert: amv2.Alert{
			GeneratorURL: "http://localhost:8080",
			Labels:       labels,
		},
	}
}

// errAutogenFn is an AutogenFn that always returns an error.
func errAutogenFn(_ context.Context, _ log.Logger, _ int64, _ *definition.PostableApiAlertingConfig, _ bool) error {
	return errTest
}

const defaultCloudAMConfig = `
global:
    resolve_timeout: 5m
    http_config:
        follow_redirects: true
        enable_http2: true
    smtp_hello: localhost
    smtp_require_tls: true
    pagerduty_url: https://events.pagerduty.com/v2/enqueue
    opsgenie_api_url: https://api.opsgenie.com/
    wechat_api_url: https://qyapi.weixin.qq.com/cgi-bin/
    victorops_api_url: https://alert.victorops.com/integrations/generic/20131114/alert/
    telegram_api_url: https://api.telegram.org
    webex_api_url: https://webexapis.com/v1/messages
route:
    receiver: empty-receiver
    continue: false
receivers:
    - name: empty-receiver
`
