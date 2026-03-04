package remote

import (
	"context"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
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
	"github.com/grafana/alerting/http/v0mimir1"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/client_golang/prometheus"
	common_config "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	alertingClusterPB "github.com/grafana/alerting/cluster/clusterpb"
	"github.com/grafana/alerting/definition"
	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
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
			am, err := NewAlertmanager(
				context.Background(),
				cfg,
				nil,
				notifier.NewCrypto(secretsService, nil, log.NewNopLogger()),
				NoopAutogenFn,
				metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry()),
				tracing.InitializeTracerForTest(),
				featuremgmt.WithFeatures(),
			)
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
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	// getOkHandler allows us to specify a full state the test server is going to respond with.
	getOkHandler := func(state string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))

			res := map[string]any{
				"status": "success",
				"data": map[string]any{
					"state": state,
				},
			}
			w.Header().Add("content-type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(res))
		}
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
			{Key: "nfl:otherID", Data: []byte("test-nflog")},
			{Key: "sil:otherID", Data: []byte("test-silences")},
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
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(test.handler)
			cfg := AlertmanagerConfig{
				OrgID:         1,
				TenantID:      tenantID,
				URL:           server.URL,
				DefaultConfig: defaultGrafanaConfig,
			}
			_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

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
	testutil.SkipIntegrationTestInShortMode(t)

	// errorHandler returns an error response for the readiness check and state sync.

	const tenantID = "test"

	errorHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		w.Header().Add("content-type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"status": "error"}))
	})

	var configSent client.UserGrafanaConfig
	var configSyncs, stateSyncs int
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
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
	encryptedReceivers, err := notifier.EncryptedReceivers(c.AlertmanagerConfig.Receivers, notifier.EncryptIntegrationSettings(context.Background(), secretsService))
	c.AlertmanagerConfig.Receivers = encryptedReceivers
	require.NoError(t, err)

	// The encrypted configuration should be different than the one we will send.
	encryptedConfig, err := json.Marshal(c)
	require.NoError(t, err)
	require.NotEqual(t, testGrafanaConfigWithSecret, encryptedConfig)

	config := func(cfg []byte) *ngmodels.AlertConfiguration {
		return &ngmodels.AlertConfiguration{AlertmanagerConfiguration: string(cfg)}
	}

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
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, testSilence1))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, testNflog1))

	newAm := func() *Alertmanager {
		_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)
		am.state = notifier.NewFileStore(1, store)
		return am
	}

	// An error response from the remote Alertmanager should result in the readiness check failing.
	am := newAm()

	orig := client.ReadinessTimeout
	client.ReadinessTimeout = 200 * time.Millisecond // Speed up the test.
	err = am.ApplyConfig(ctx, config(encryptedConfig))
	client.ReadinessTimeout = orig
	require.Error(t, err)
	require.False(t, am.Ready())
	require.Equal(t, 0, stateSyncs)
	require.Equal(t, 0, configSyncs)

	// A 200 status code response should make the check succeed.
	server.Config.Handler = okHandler
	err = am.ApplyConfig(ctx, config(encryptedConfig))
	require.NoError(t, err)
	require.True(t, am.Ready())
	require.Equal(t, 1, stateSyncs)
	require.Equal(t, 1, configSyncs)

	// The sent configuration should be unencrypted and promoted.
	verifyAutogenExistsAndRemove(t, &configSent)
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
	err = am.ApplyConfig(ctx, config(encryptedConfig))
	require.NoError(t, err)
	require.Equal(t, 1, stateSyncs)
	require.Equal(t, 1, configSyncs)

	// Changing the sync interval and calling ApplyConfig again with a new config
	// should result in us sending the configuration but not the state.
	am.syncInterval = 0
	err = am.ApplyConfig(ctx, config([]byte(testGrafanaConfig)))
	require.NoError(t, err)
	require.Equal(t, 2, configSyncs)
	require.Equal(t, 1, stateSyncs)

	// After a restart, the Alertmanager shouldn't send the configuration if it has not changed.
	am = newAm()
	require.NoError(t, err)
	err = am.ApplyConfig(ctx, config([]byte(testGrafanaConfig)))
	require.NoError(t, err)
	require.Equal(t, 2, configSyncs)

	// Changing the "from" address should result in the configuration being updated.
	cfg.SmtpConfig.FromAddress = "new-address@test.com"
	am = newAm()
	require.NoError(t, err)
	err = am.ApplyConfig(ctx, config([]byte(testGrafanaConfig)))
	require.NoError(t, err)
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
	am = newAm()
	require.NoError(t, err)
	err = am.ApplyConfig(ctx, config([]byte(testGrafanaConfig)))
	require.NoError(t, err)
	require.Equal(t, 4, configSyncs)
	require.Equal(t, am.smtp, configSent.SmtpConfig)

	// Failing to add the auto-generated routes should not result in an error.
	am = newAm()
	am.autogenFn = errAutogenFn
	err = am.ApplyConfig(ctx, config([]byte(testGrafanaConfig)))
	require.ErrorIs(t, err, errTest)
}

func TestCompareAndSendConfiguration(t *testing.T) {
	const tenantID = "test"
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		w.Header().Add("content-type", "application/json")

		b, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, r.Body.Close())
		got = string(b)

		_, err = w.Write([]byte(`{"status": "success"}`))
		require.NoError(t, err)
	}))

	cfg := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
	}

	cloneConfig := func(c apimodels.PostableUserConfig) apimodels.PostableUserConfig {
		clone, err := json.Marshal(c)
		require.NoError(t, err)
		var cloneCfg apimodels.PostableUserConfig
		require.NoError(t, json.Unmarshal(clone, &cloneCfg))
		return cloneCfg
	}

	// Create a config with correctly encrypted and encoded secrets.
	var inputCfg apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithSecret), &inputCfg))
	encryptedReceivers, err := notifier.EncryptedReceivers(inputCfg.AlertmanagerConfig.Receivers, notifier.EncryptIntegrationSettings(context.Background(), secretsService))
	inputCfg.AlertmanagerConfig.Receivers = encryptedReceivers
	require.NoError(t, err)
	testGrafanaConfigWithEncryptedSecret := cloneConfig(inputCfg)

	// Created a config with invalid base64 encoding in the secret.
	inputCfg.AlertmanagerConfig.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].SecureSettings["password"] = "!"
	testGrafanaConfigWithBadEncoding := cloneConfig(inputCfg)

	// Create a config with a valid base64 encoding but an invalid encryption.
	inputCfg.AlertmanagerConfig.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].SecureSettings["password"] = base64.StdEncoding.EncodeToString([]byte("test"))
	testGrafanaConfigWithBadEncryption := cloneConfig(inputCfg)

	test, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
	require.NoError(t, err)
	cfgWithDecryptedSecret := client.GrafanaAlertmanagerConfig{
		TemplateFiles:      test.TemplateFiles,
		AlertmanagerConfig: test.AlertmanagerConfig,
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
		name                  string
		config                apimodels.PostableUserConfig
		autogenConfig         map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting
		enabledMultipleRoutes bool
		expCfg                *client.UserGrafanaConfig
		expErrContains        []string
	}{
		{
			name:           "invalid config",
			config:         apimodels.PostableUserConfig{},
			expErrContains: []string{"no routes provided"},
		},
		{
			name:           "invalid base-64 in key",
			config:         testGrafanaConfigWithBadEncoding,
			expErrContains: []string{`"grafana-default-email"`, "dde6ntuob69dtf", "password", "illegal base64 data at input byte 0"},
		},
		{
			name:           "decrypt error",
			config:         testGrafanaConfigWithBadEncryption,
			expErrContains: []string{`"grafana-default-email"`, "dde6ntuob69dtf", "password", "unable to compute salt"},
		},
		{
			name:   "error from autogen function",
			config: testGrafanaConfigWithEncryptedSecret,
			autogenConfig: map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{
				1: {
					ngmodels.AlertRuleKey{OrgID: 1, UID: "rule-uid-test"}: {
						Receiver: "some non-existent receiver",
					},
				},
			},
			expErrContains: []string{"some non-existent receiver", "does not exist"},
		},
		{
			name:   "no error",
			config: testGrafanaConfigWithEncryptedSecret,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithDecryptedSecret,
			},
		},
		{
			name:   "no error, with auto-generated routes",
			config: testGrafanaConfigWithEncryptedSecret,
			autogenConfig: map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{
				1: {
					ngmodels.AlertRuleKey{OrgID: 1, UID: "rule-uid-test"}: {
						Receiver: "grafana-default-email", // Some existing receiver.
					},
				},
			},
			expCfg: func() *client.UserGrafanaConfig {
				testAutogenRoutes, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
				require.NoError(t, err)
				matcher := func(key, val string) definition.ObjectMatchers {
					m, err := labels.NewMatcher(labels.MatchEqual, key, val)
					require.NoError(t, err)
					return definition.ObjectMatchers{m}
				}
				testAutogenRoutes.AlertmanagerConfig.Route.Routes = append([]*definition.Route{
					{
						Receiver:       "grafana-default-email",
						ObjectMatchers: matcher(ngmodels.AutogeneratedRouteLabel, "true"),
						Routes: []*definition.Route{
							{
								Receiver:       "grafana-default-email",
								ObjectMatchers: matcher(ngmodels.AutogeneratedRouteReceiverNameLabel, "grafana-default-email"),
								GroupByStr:     []string{ngmodels.FolderTitleLabel, model.AlertNameLabel},
								GroupBy:        []model.LabelName{ngmodels.FolderTitleLabel, model.AlertNameLabel},
							},
						},
					},
				}, testAutogenRoutes.AlertmanagerConfig.Route.Routes...)

				return &client.UserGrafanaConfig{
					GrafanaAlertmanagerConfig: client.GrafanaAlertmanagerConfig{
						TemplateFiles:      testAutogenRoutes.TemplateFiles,
						AlertmanagerConfig: testAutogenRoutes.AlertmanagerConfig,
					},
				}
			}(),
		},
		{
			name:   "no error, with extra configurations",
			config: *cfgWithExtraUnmerged,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithExtraMerged,
			},
		},
		{
			name:                  "no error, with extra configurations and managed routes enabled",
			config:                *cfgWithExtraUnmerged,
			enabledMultipleRoutes: true,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: func() client.GrafanaAlertmanagerConfig {
					cfgWithExtraUnmerged, err := notifier.Load(cfgWithExtraUnmergedBytes)
					require.NoError(t, err)
					r, err := cfgWithExtraUnmerged.GetMergedAlertmanagerConfig()
					require.NoError(t, err)
					managed := make(map[string]*definition.Route)
					managed[r.Identifier] = r.ExtraRoute
					r.Config.Route = legacy_storage.WithManagedRoutes(r.Config.Route, managed)
					importedRules, err := legacy_storage.BuildManagedInhibitionRules(r.Identifier, r.ExtraInhibitRules)
					require.NoError(t, err)
					r.Config.InhibitRules = legacy_storage.WithManagedInhibitionRules(r.Config.InhibitRules, importedRules)
					cfgWithExtraMerged := client.GrafanaAlertmanagerConfig{
						TemplateFiles:      cfgWithExtraUnmerged.TemplateFiles,
						AlertmanagerConfig: r.Config,
						Templates:          definition.TemplatesMapToPostableAPITemplates(cfgWithExtraUnmerged.ExtraConfigs[0].TemplateFiles, definition.MimirTemplateKind),
					}
					return cfgWithExtraMerged
				}(),
			},
		},
		{
			name:                  "no error, with managed routes",
			config:                *policy_exports.Config(),
			enabledMultipleRoutes: true,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: client.GrafanaAlertmanagerConfig{
					AlertmanagerConfig: func() definition.PostableApiAlertingConfig {
						c := policy_exports.Config()
						c.AlertmanagerConfig.Route = legacy_storage.WithManagedRoutes(c.AlertmanagerConfig.Route, c.ManagedRoutes)
						return c.AlertmanagerConfig
					}(),
				},
			},
		},
		{
			name:                  "no error, with managed routes but flag disabled",
			config:                *policy_exports.Config(),
			enabledMultipleRoutes: false,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: client.GrafanaAlertmanagerConfig{
					AlertmanagerConfig: policy_exports.Config().AlertmanagerConfig,
				},
			},
		},
		{
			name: "do not add managed route from extra config if name conflict",
			config: func() apimodels.PostableUserConfig {
				c, err := notifier.Load(cfgWithExtraUnmergedBytes)
				require.NoError(t, err)

				c.ManagedRoutes = map[string]*definition.Route{
					"imported": {Receiver: "grafana-default-email"},
				}
				return *c
			}(),
			enabledMultipleRoutes: true,
			expCfg: &client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: func() client.GrafanaAlertmanagerConfig {
					cfgWithExtraUnmerged, err := notifier.Load(cfgWithExtraUnmergedBytes)
					require.NoError(t, err)
					r, err := cfgWithExtraUnmerged.GetMergedAlertmanagerConfig()
					require.NoError(t, err)
					r.Config.Route = legacy_storage.WithManagedRoutes(r.Config.Route, map[string]*definition.Route{
						"imported": {Receiver: "grafana-default-email"},
					})
					cfgWithExtraMerged := client.GrafanaAlertmanagerConfig{
						TemplateFiles:      cfgWithExtraUnmerged.TemplateFiles,
						AlertmanagerConfig: r.Config,
						Templates:          definition.TemplatesMapToPostableAPITemplates(cfgWithExtraUnmerged.ExtraConfigs[0].TemplateFiles, definition.MimirTemplateKind),
					}
					return cfgWithExtraMerged
				}(),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()

			features := featuremgmt.WithFeatures()
			if test.enabledMultipleRoutes {
				features = featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies)
			}
			moa, _ := newRemoteMOA(t, cfg, test.autogenConfig, features, secretsService)

			dbConfig := func() *ngmodels.AlertConfiguration {
				raw, err := json.Marshal(test.config)
				require.NoError(t, err)
				return &ngmodels.AlertConfiguration{
					AlertmanagerConfiguration: string(raw),
					CreatedAt:                 time.Now().Unix(),
				}
			}()
			err = moa.ApplyConfig(ctx, 1, dbConfig)
			if len(test.expErrContains) == 0 {
				require.NoError(t, err)

				var gotCfg client.UserGrafanaConfig
				require.NoError(t, json.Unmarshal([]byte(got), &gotCfg))

				require.NotEmpty(t, gotCfg.Hash)
				require.NotEmpty(t, gotCfg.CreatedAt)

				if test.autogenConfig == nil {
					// For tests that aren't specifically testing autogenerated routes, we simply check if the routes
					// exist and remove them for the config comparison.
					verifyAutogenExistsAndRemove(t, &gotCfg)
				}

				require.Empty(t, cmp.Diff(test.expCfg, &gotCfg,
					// do not compare hashes because the config is processed slightly different: empty maps are nils.
					cmpopts.IgnoreFields(client.UserGrafanaConfig{}, "Hash", "CreatedAt"),
					cmpopts.EquateEmpty(),
					cmpopts.IgnoreUnexported(
						time.Location{},
						labels.Matcher{},
						v0mimir1.ProxyConfig{},
						common_config.ProxyConfig{})))

				got1 := got
				got = ""
				err = moa.ApplyConfig(ctx, 1, dbConfig)
				require.NoError(t, err)

				got2 := got
				require.Equalf(t, got1, got2, "Configuration is not idempotent")
				return
			}
			for _, expErr := range test.expErrContains {
				require.ErrorContains(t, err, expErr)
			}
		})
	}
}

func Test_TestReceiversDecryptsSecureSettings(t *testing.T) {
	const tenantID = "test"
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	var got apimodels.TestReceiversConfigBodyParams
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))
		w.Header().Add("Content-Type", "application/json")
		require.NoError(t, json.NewDecoder(r.Body).Decode(&got))
		require.NoError(t, r.Body.Close())
		_, err := w.Write([]byte(`{"status": "success"}`))
		require.NoError(t, err)
	}))

	cfg := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
	}

	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

	var inputCfg apimodels.PostableUserConfig
	require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithSecret), &inputCfg))
	encryptedReceivers, err := notifier.EncryptedReceivers(inputCfg.AlertmanagerConfig.Receivers, notifier.EncryptIntegrationSettings(context.Background(), secretsService))
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
	mustLoad := func(raw string) *apimodels.PostableUserConfig {
		parsed, err := notifier.Load([]byte(raw))
		require.NoError(t, err)
		return parsed
	}

	tests := []struct {
		name                 string
		config               *apimodels.PostableUserConfig
		notificationSettings map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting
		features             featuremgmt.FeatureToggles
		expected             bool
	}{
		{
			name:     "valid configuration",
			config:   mustLoad(testGrafanaConfig),
			expected: false,
		},
		{
			name:     "default configuration",
			config:   mustLoad(defaultGrafanaConfig),
			expected: true,
		},
		{
			name:     "default configuration with different field order",
			config:   mustLoad(testGrafanaDefaultConfigWithDifferentFieldOrder),
			expected: false,
		},
		{
			name:     "other valid config",
			config:   mustLoad(testGrafanaConfigWithSecret),
			expected: false,
		},
		{
			name:     "default configuration and FF enabled",
			config:   mustLoad(defaultGrafanaConfig),
			features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies), // Flag shouldn't affect Default status if there aren't any ManagedRoutes.
			expected: true,
		},
		{
			name: "default config with ManagedRoutes and FF disabled",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.ManagedRoutes = map[string]*definition.Route{
					"imported": {Receiver: "empty"},
				}
				return c
			}(),
			expected: true,
		},
		//{ TODO: Fix default hash calculation
		//	name: "default config with ManagedRoutes and FF enabled",
		//	config: func() *apimodels.PostableUserConfig {
		//		c := mustLoad(defaultGrafanaConfig)
		//		c.ManagedRoutes = map[string]*definition.Route{
		//			"imported": {Receiver: "empty"},
		//		}
		//		return c
		//	}(),
		//	features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies),
		//	expected: false,
		//},
		{
			name: "default config with ExtraConfig and FF disabled",
			config: func() *apimodels.PostableUserConfig {
				cfgWithExtraUnmergedBytes, err := testData.ReadFile(path.Join("test-data", "config-with-extra.json"))
				require.NoError(t, err)
				cfgWithExtraUnmerged, err := notifier.Load(cfgWithExtraUnmergedBytes)
				require.NoError(t, err)
				return cfgWithExtraUnmerged
			}(),
			expected: false, // Even disabled the ExtraConfig is merged into the Route.
		},
		{
			name: "default config with ExtraConfig and FF enabled",
			config: func() *apimodels.PostableUserConfig {
				cfgWithExtraUnmergedBytes, err := testData.ReadFile(path.Join("test-data", "config-with-extra.json"))
				require.NoError(t, err)
				cfgWithExtraUnmerged, err := notifier.Load(cfgWithExtraUnmergedBytes)
				require.NoError(t, err)
				return cfgWithExtraUnmerged
			}(),
			features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies),
			expected: false,
		},
		{
			name: "default config with TemplateFiles",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.TemplateFiles = map[string]string{"test": "test"}
				return c
			}(),
			expected: false,
		},
		{
			name: "default config with MuteTimeInterval",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{{Name: "test"}}
				return c
			}(),
			expected: false,
		},
		{
			name: "default config with TimeIntervals",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.AlertmanagerConfig.TimeIntervals = []config.TimeInterval{{Name: "test"}}
				return c
			}(),
			expected: false,
		},
		{
			name: "default config with InhibitRules",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.AlertmanagerConfig.InhibitRules = []config.InhibitRule{{}}
				return c
			}(),
			expected: false,
		},
		{
			name: "default config with ManagedInhibitionRules and FF disabled",
			config: func() *apimodels.PostableUserConfig {
				c := mustLoad(defaultGrafanaConfig)
				c.ManagedInhibitionRules = map[string]*apimodels.InhibitionRule{
					"imported": {Name: "imported"},
				}
				return c
			}(),
			expected: true,
		},
		//{ TODO: Fix default hash calculation
		//	name: "default config with ManagedInhibitionRules and FF enabled",
		//	config: func() *apimodels.PostableUserConfig {
		//		c := mustLoad(defaultGrafanaConfig)
		//		c.ManagedInhibitionRules = map[string]*apimodels.InhibitionRule{
		//			"imported": {Name: "imported"},
		//		}
		//		return c
		//	}(),
		//	features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies),
		//	expected: false,
		//},
		//{ TODO: Fix default hash calculation
		//	name:   "default config with rule notification settings",
		//	config: mustLoad(defaultGrafanaConfig),
		//	notificationSettings: map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{
		//		1: {
		//			ngmodels.AlertRuleKey{OrgID: 1, UID: "rule-uid-test"}: {
		//				Receiver: "empty",
		//				GroupBy:  []string{"something else"},
		//			},
		//		},
		//	},
		//	expected: false,
		//},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			const tenantID = "test"

			var configSent client.UserGrafanaConfig
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))

				if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/config") {
					require.NoError(t, json.NewDecoder(r.Body).Decode(&configSent))
				}

				w.Header().Add("content-type", "application/json")
				require.NoError(t, json.NewEncoder(w).Encode(map[string]string{"status": "success"}))
			}))
			defer server.Close()

			secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))
			c := AlertmanagerConfig{
				OrgID:         1,
				TenantID:      tenantID,
				URL:           server.URL,
				DefaultConfig: defaultGrafanaConfig,
				PromoteConfig: true,
			}

			features := featuremgmt.WithFeatures()
			if test.features != nil {
				features = test.features
			}

			moa, _ := newRemoteMOA(t, c, nil, features, secretsService)

			dbConfig := func() *ngmodels.AlertConfiguration {
				raw, err := json.Marshal(test.config)
				require.NoError(t, err)
				return &ngmodels.AlertConfiguration{
					AlertmanagerConfiguration: string(raw),
					CreatedAt:                 time.Now().Unix(),
				}
			}()
			err := moa.ApplyConfig(context.Background(), 1, dbConfig)
			require.NoError(t, err)

			require.Equalf(t, test.expected, configSent.Default, "expected default configuration to be %v", test.expected)
			require.NotEmpty(t, configSent.Hash)
		})
	}
}

func TestApplyConfigWithExtraConfigs(t *testing.T) {
	const tenantID = "test"

	var configSent client.UserGrafanaConfig
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, tenantID, r.Header.Get(client.MimirTenantHeader))

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

	c := AlertmanagerConfig{
		OrgID:         1,
		TenantID:      tenantID,
		URL:           server.URL,
		DefaultConfig: defaultGrafanaConfig,
		PromoteConfig: true,
	}

	moa, _ := newRemoteMOA(t, c, nil, featuremgmt.WithFeatures(), secretsService)

	dbConfig := func() *ngmodels.AlertConfiguration {
		raw, err := json.Marshal(cfg)
		require.NoError(t, err)
		return &ngmodels.AlertConfiguration{
			AlertmanagerConfiguration: string(raw),
			CreatedAt:                 time.Now().Unix(),
		}
	}()
	err := moa.ApplyConfig(context.Background(), 1, dbConfig)
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
					Receiver: apimodels.Receiver{Name: "grafana-default-email"},
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

	moa, _ := newRemoteMOA(t, c, nil, featuremgmt.WithFeatures(), secretsService)

	dbConfig := func() *ngmodels.AlertConfiguration {
		raw, err := json.Marshal(cfg)
		require.NoError(t, err)
		return &ngmodels.AlertConfiguration{
			AlertmanagerConfiguration: string(raw),
			CreatedAt:                 time.Now().Unix(),
		}
	}()
	err = moa.ApplyConfig(ctx, 1, dbConfig)
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
	testutil.SkipIntegrationTestInShortMode(t)

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

	var testConfigCreatedAt int64

	store := ngfakes.NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	moa, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)
	am.state = notifier.NewFileStore(1, store)

	ctx := context.Background()
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, testSilence1))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, testNflog1))

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
		err = moa.ApplyConfig(ctx, 1, &ngmodels.AlertConfiguration{AlertmanagerConfiguration: testGrafanaConfig, CreatedAt: time.Now().Unix()})
		require.NoError(t, err)

		// First, we need to verify that the readiness check passes.
		require.True(t, am.Ready())

		// Next, we need to verify that Mimir received both the configuration and state.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		verifyAutogenExistsAndRemove(t, config)

		rawCfg, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)
		require.JSONEq(t, testGrafanaConfig, string(rawCfg))
		require.False(t, config.Default)

		state, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.NoError(t, err)
		require.Equal(t, encodedFullState, state.State)

		testConfigCreatedAt = config.CreatedAt
	}

	// Calling `ApplyConfig` again with an unchanged configuration and state yields no effect.
	{
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "silences", testSilence2))
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "notifications", testNflog2))
		err = moa.ApplyConfig(ctx, 1, &ngmodels.AlertConfiguration{AlertmanagerConfiguration: testGrafanaConfig, CreatedAt: time.Now().Unix()})
		require.NoError(t, err)

		// The remote Alertmanager continues to be ready.
		require.True(t, am.Ready())

		// Next, we need to verify that the config that was uploaded remains the same.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		verifyAutogenExistsAndRemove(t, config)

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
		encryptedReceivers, err := notifier.EncryptedReceivers(postableCfg.AlertmanagerConfig.Receivers, notifier.EncryptIntegrationSettings(context.Background(), secretsService))
		postableCfg.AlertmanagerConfig.Receivers = encryptedReceivers
		require.NoError(t, err)

		// The encrypted configuration should be different than the one we will send.
		encryptedConfig, err := json.Marshal(postableCfg)
		require.NoError(t, err)
		require.NotEqual(t, testGrafanaConfigWithSecret, encryptedConfig)

		// Call `SaveAndApplyConfig` with the encrypted configuration.
		err = moa.ApplyConfig(ctx, 1, &ngmodels.AlertConfiguration{AlertmanagerConfiguration: string(encryptedConfig), CreatedAt: time.Now().Unix()})
		require.NoError(t, err)

		// Check that the original configuration is not modified (decrypted).
		currentJSON, err := json.Marshal(postableCfg)
		require.NoError(t, err)
		require.JSONEq(t, string(encryptedConfig), string(currentJSON), "Original configuration should not be modified")

		// Check that the configuration was uploaded to the remote Alertmanager.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		verifyAutogenExistsAndRemove(t, config)

		got, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)

		require.JSONEq(t, testGrafanaConfigWithSecret, string(got))

		require.False(t, config.Default)

		// An error while adding auto-generated rutes should be returned.
		orig := am.autogenFn
		am.autogenFn = errAutogenFn
		err = moa.ApplyConfig(ctx, 1, &ngmodels.AlertConfiguration{AlertmanagerConfiguration: string(encryptedConfig), CreatedAt: time.Now().Unix()})
		am.autogenFn = orig
		require.ErrorIs(t, err, errTest)
	}

	// Calling `ApplyConfig` with the default config should send Default=true.
	{
		err = moa.ApplyConfig(ctx, 1, &ngmodels.AlertConfiguration{AlertmanagerConfiguration: am.defaultConfig, CreatedAt: time.Now().Unix()})
		require.NoError(t, err)

		// The remote Alertmanager continues to be ready.
		require.True(t, am.Ready())

		// Next, we need to verify that the config that was uploaded remains the same.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)

		require.True(t, config.Default)
	}
}

func TestIntegrationRemoteAlertmanagerGetStatus(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

	// We should get the default Cloud Alertmanager configuration.
	status, err := am.GetStatus(ctx)
	require.NoError(t, err)
	b, err := yaml.Marshal(status.Config)
	require.NoError(t, err)
	require.YAMLEq(t, defaultCloudAMConfig, string(b))
}

func TestIntegrationRemoteAlertmanagerSilences(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

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
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

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
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

	// We should start with the default config.
	rcvs, err := am.GetReceivers(ctx)
	require.NoError(t, err)
	require.Equal(t, []alertingModels.ReceiverStatus{
		{
			Active:       true,
			Name:         "empty-receiver",
			Integrations: []alertingModels.IntegrationStatus{},
		},
	}, rcvs)
}

func TestIntegrationRemoteAlertmanagerTestTemplates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

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

func TestIntegrationRemoteAlertmanagerTestIntegration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	_, am := newRemoteMOA(t, cfg, nil, featuremgmt.WithFeatures(), secretsService)

	integration := ngmodels.IntegrationGen(ngmodels.IntegrationMuts.WithValidConfig("webhook"))()
	integration.Settings["url"] = "grafana://noop" // TODO remove later if https://github.com/grafana/alerting/pull/465 merged
	testAlert := alertingModels.TestReceiversConfigAlertParams{
		Annotations: model.LabelSet{
			"annotations_label": "annotations_value",
		},
		Labels: model.LabelSet{
			"alertname": "test",
			"severity":  "critical",
		},
	}
	result, err := am.TestIntegration(ctx, "test-receiver", integration, testAlert)
	require.NoError(t, err)
	require.NotEmpty(t, result.LastNotifyAttemptDuration)
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
func errAutogenFn(_ context.Context, _ log.Logger, _ int64, _ *definition.PostableApiAlertingConfig, _ notifier.InvalidReceiversAction) error {
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

func newRemoteMOA(t *testing.T, cfg AlertmanagerConfig, notificationSettings map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting, features featuremgmt.FeatureToggles, secretsService *secretsManager.SecretsService) (*notifier.MultiOrgAlertmanager, *Alertmanager) {
	cfgStore := notifier.NewFakeNotificationStore(t, notificationSettings)
	testCrypto := notifier.NewCrypto(secretsService, nil, log.NewNopLogger())
	fstore := notifier.NewFileStore(1, ngfakes.NewFakeKVStore(t))

	am, err := NewAlertmanager(
		context.Background(),
		cfg,
		fstore,
		testCrypto,
		func(ctx context.Context, logger log.Logger, orgId int64, config *apimodels.PostableApiAlertingConfig, _ notifier.InvalidReceiversAction) error {
			return notifier.AddAutogenConfig(ctx, logger, cfgStore, orgId, config, notifier.ErrorOnInvalidReceivers, features)
		},
		metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry()),
		tracing.InitializeTracerForTest(),
		features,
	)
	require.NoError(t, err)

	return notifier.NewTestMultiOrgAlertmanager(t,
		notifier.WithFeatureToggles(am.features),
		notifier.WithSecretService(secretsService),
		notifier.WithConfigStore(cfgStore),
		notifier.WithAlertmanagers(map[int64]notifier.Alertmanager{
			1: am,
		}),
		notifier.WithSkipLoad(),
	), am
}

// verifyAutogenExistsAndRemove is a helper function to ensure autogenerated routes were created but without validating them exactly.
func verifyAutogenExistsAndRemove(t *testing.T, cfg *client.UserGrafanaConfig) {
	// First ensure there are some autogenerated routes.
	require.True(t, slices.ContainsFunc(cfg.GrafanaAlertmanagerConfig.AlertmanagerConfig.Route.Routes, func(route *apimodels.Route) bool {
		if !notifier.IsAutogeneratedRoot(route) {
			return false
		}
		return len(route.Routes) > 0
	}))
	// Now remove them for the config comparison.
	notifier.RemoveAutogenConfigIfExists(cfg.GrafanaAlertmanagerConfig.AlertmanagerConfig.Route)
}
