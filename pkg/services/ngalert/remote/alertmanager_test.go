package remote

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

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

var (
	testPasswordBase64   = base64.StdEncoding.EncodeToString([]byte(testPassword))
	defaultGrafanaConfig = setting.GetAlertmanagerDefaultConfiguration()
	errTest              = errors.New("test")

	// Valid Grafana Alertmanager configuration with secret in base64.
	testGrafanaConfigWithEncryptedSecret = fmt.Sprintf(`{"template_files":{},"alertmanager_config":{"time_intervals":[{"name":"weekends","time_intervals":[{"weekdays":["saturday","sunday"],"location":"Africa/Accra"}]}],"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"dde6ntuob69dtf","name":"WH","type":"webhook","disableResolveMessage":false,"settings":{"url":"http://localhost:8080","username":"test"},"secureSettings":{"password":"%s"}}]}]}}`, testPasswordBase64)
)

const (
	testPassword = "test"

	// Valid Grafana Alertmanager configurations.
	testGrafanaConfig                               = `{"template_files":{},"alertmanager_config":{"time_intervals":[{"name":"weekends","time_intervals":[{"weekdays":["saturday","sunday"],"location":"Africa/Accra"}]}],"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"}}]}]}}`
	testGrafanaConfigWithSecret                     = `{"template_files":{},"alertmanager_config":{"time_intervals":[{"name":"weekends","time_intervals":[{"weekdays":["saturday","sunday"],"location":"Africa/Accra"}]}],"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"dde6ntuob69dtf","name":"WH","type":"webhook","disableResolveMessage":false,"settings":{"url":"http://localhost:8080","username":"test"},"secureSettings":{"password":"test"}}]}]}}`
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
			am, err := NewAlertmanager(context.Background(), cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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

func TestApplyConfig(t *testing.T) {
	const tenantID = "test"
	// errorHandler returns an error response for the readiness check and state sync.
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
				require.NoError(t, json.NewDecoder(r.Body).Decode(&configSent))
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
	err := notifier.EncryptReceiverConfigs(c.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
		return secretsService.Encrypt(ctx, payload, secrets.WithoutScope())
	})
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
		SmtpFrom:      "test-instance@grafana.net",
		StaticHeaders: map[string]string{"Header-1": "Value-1", "Header-2": "Value-2"},
	}

	ctx := context.Background()
	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, testSilence1))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, testNflog1))

	// An error response from the remote Alertmanager should result in the readiness check failing.
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(ctx, cfg, fstore, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
	require.Equal(t, cfg.SmtpFrom, configSent.SmtpFrom)
	require.Equal(t, cfg.StaticHeaders, configSent.StaticHeaders)

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
	am, err = NewAlertmanager(context.Background(), cfg, fstore, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 2, configSyncs)

	// Changing the "from" address should result in the configuration being updated.
	cfg.SmtpFrom = "new-address@test.com"
	am, err = NewAlertmanager(context.Background(), cfg, fstore, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
	require.NoError(t, err)
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.Equal(t, 3, configSyncs)
	require.Equal(t, am.smtpFrom, configSent.SmtpFrom)

	// Failing to add the auto-generated routes should result in an error.
	_, err = NewAlertmanager(context.Background(), cfg, fstore, secretsService.Decrypt, errAutogenFn, m, tracing.InitializeTracerForTest())
	require.ErrorIs(t, err, errTest)
	require.Equal(t, 3, configSyncs)
}

func TestCompareAndSendConfiguration(t *testing.T) {
	const tenantID = "test"
	cfgWithSecret, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
	require.NoError(t, err)
	testValue := []byte("test")
	decryptFn := func(_ context.Context, payload []byte) ([]byte, error) {
		if string(payload) == string(testValue) {
			return testValue, nil
		}
		return nil, errTest
	}

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

	cfgWithAutogenRoutes, err := notifier.Load([]byte(testGrafanaConfigWithSecret))
	require.NoError(t, err)
	require.NoError(t, testAutogenFn(nil, nil, 0, &cfgWithAutogenRoutes.AlertmanagerConfig, false))

	tests := []struct {
		name      string
		config    string
		autogenFn AutogenFn
		expCfg    *client.UserGrafanaConfig
		expErr    string
	}{
		{
			"invalid config",
			"{}",
			NoopAutogenFn,
			nil,
			"unable to parse Alertmanager configuration: no route provided in config",
		},
		{
			"invalid base-64 in key",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, `"password":"!"`, 1),
			NoopAutogenFn,
			nil,
			`unable to decrypt settings on receiver "WH" (uid: "dde6ntuob69dtf"): failed to decode value for key 'password': illegal base64 data at input byte 0`,
		},
		{
			"decrypt error",
			testGrafanaConfigWithSecret,
			NoopAutogenFn,
			nil,
			fmt.Sprintf(`unable to decrypt settings on receiver "WH" (uid: "dde6ntuob69dtf"): failed to decrypt value for key 'password': %s`, errTest.Error()),
		},
		{
			"error from autogen function",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, fmt.Sprintf("%q:%q", "password", base64.StdEncoding.EncodeToString(testValue)), 1),
			errAutogenFn,
			nil,
			errTest.Error(),
		},
		{
			"no error",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, fmt.Sprintf("%q:%q", "password", base64.StdEncoding.EncodeToString(testValue)), 1),
			NoopAutogenFn,
			&client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithSecret,
			},
			"",
		},
		{
			"no error, with auto-generated routes",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, fmt.Sprintf("%q:%q", "password", base64.StdEncoding.EncodeToString(testValue)), 1),
			testAutogenFn,
			&client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: cfgWithAutogenRoutes,
			},
			"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			ctx := context.Background()
			am, err := NewAlertmanager(ctx,
				cfg,
				fstore,
				decryptFn,
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
			if test.expErr == "" {
				require.NoError(tt, err)
				rawCfg, err := json.Marshal(test.expCfg)
				require.NoError(tt, err)
				require.JSONEq(tt, string(rawCfg), got)
				return
			}
			require.Equal(tt, test.expErr, err.Error())
		})
	}
}

func Test_TestReceiversDecryptsSecureSettings(t *testing.T) {
	const tenantID = "test"
	const testKey = "test-key"
	const testValue = "test-value"
	decryptFn := func(_ context.Context, payload []byte) ([]byte, error) {
		if string(payload) == testValue {
			return []byte(testValue), nil
		}
		return nil, errTest
	}

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
		decryptFn,
		NoopAutogenFn,
		m,
		tracing.InitializeTracerForTest(),
	)

	require.NoError(t, err)
	params := apimodels.TestReceiversConfigBodyParams{
		Alert: &apimodels.TestReceiversConfigAlertParams{},
		Receivers: []*definition.PostableApiReceiver{
			{
				PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
						{
							SecureSettings: map[string]string{
								testKey: base64.StdEncoding.EncodeToString([]byte(testValue)),
							},
						},
					},
				},
			},
		},
	}

	_, _, err = am.TestReceivers(context.Background(), params)
	require.NoError(t, err)
	require.Equal(t, map[string]string{testKey: testValue}, got.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers[0].SecureSettings)
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
			require.Equal(tt, test.expected, am.isDefaultConfiguration(md5.Sum(raw)))
		})
	}
}

func TestDecryptConfiguration(t *testing.T) {
	t.Run("should not modify the original config", func(t *testing.T) {
		var inputCfg apimodels.PostableUserConfig
		require.NoError(t, json.Unmarshal([]byte(testGrafanaConfigWithEncryptedSecret), &inputCfg))

		decryptFn := func(_ context.Context, payload []byte) ([]byte, error) {
			if string(payload) == testPassword {
				return []byte(testPassword), nil
			}
			return nil, fmt.Errorf("incorrect payload")
		}

		am := &Alertmanager{
			decrypt: decryptFn,
		}

		rawDecrypted, _, err := am.decryptConfiguration(context.Background(), &inputCfg)
		require.NoError(t, err)

		currentJSON, err := json.Marshal(inputCfg)
		require.NoError(t, err)
		require.JSONEq(t, testGrafanaConfigWithEncryptedSecret, string(currentJSON), "Original configuration should not be modified")

		var decryptedCfg apimodels.PostableUserConfig
		require.NoError(t, json.Unmarshal(rawDecrypted, &decryptedCfg))

		found := false
		for _, rcv := range decryptedCfg.AlertmanagerConfig.Receivers {
			for _, gmr := range rcv.GrafanaManagedReceivers {
				if gmr.Type == "webhook" && gmr.SecureSettings["password"] == testPassword {
					found = true
				}
			}
		}
		require.True(t, found, "Decrypted configuration should contain decrypted password")
	})
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

	testConfigHash := fmt.Sprintf("%x", md5.Sum([]byte(testGrafanaConfig)))
	testConfigCreatedAt := time.Now().Unix()
	testConfig := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: testGrafanaConfig,
		ConfigurationHash:         testConfigHash,
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
	am, err := NewAlertmanager(ctx, cfg, fstore, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
		require.Equal(t, testConfigHash, config.Hash)
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
		require.Equal(t, testConfigHash, config.Hash)
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
		err = notifier.EncryptReceiverConfigs(postableCfg.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
			return secretsService.Encrypt(ctx, payload, secrets.WithoutScope())
		})
		require.NoError(t, err)

		// The encrypted configuration should be different than the one we will send.
		encryptedConfig, err := json.Marshal(postableCfg)
		require.NoError(t, err)
		require.NotEqual(t, testGrafanaConfigWithSecret, encryptedConfig)

		// Call `SaveAndApplyConfig` with the encrypted configuration.
		require.NoError(t, err)
		require.NoError(t, am.SaveAndApplyConfig(ctx, postableCfg))

		// Check that the configuration was uploaded to the remote Alertmanager.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)
		got, err := json.Marshal(config.GrafanaAlertmanagerConfig)
		require.NoError(t, err)

		require.JSONEq(t, testGrafanaConfigWithSecret, string(got))
		require.Equal(t, fmt.Sprintf("%x", md5.Sum(encryptedConfig)), config.Hash)
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
		require.Equal(t, fmt.Sprintf("%x", md5.Sum(want)), config.Hash)
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
	am, err := NewAlertmanager(ctx, cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
	am, err := NewAlertmanager(ctx, cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
	am, err := NewAlertmanager(ctx, cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
	am, err := NewAlertmanager(ctx, cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
	am, err := NewAlertmanager(ctx, cfg, nil, secretsService.Decrypt, NoopAutogenFn, m, tracing.InitializeTracerForTest())
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
