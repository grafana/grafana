package remote

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
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

	"github.com/grafana/grafana/pkg/infra/db"
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
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

// Valid Grafana Alertmanager configurations.
const testGrafanaConfig = `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
const testGrafanaConfigWithSecret = `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"dde6ntuob69dtf","name":"WH","type":"webhook","disableResolveMessage":false,"settings":{"url":"http://localhost:8080","username":"test"},"secureSettings":{"password":"test"}}]}]}}`

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
			}
			m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
			am, err := NewAlertmanager(cfg, nil, secretsService.Decrypt, m)
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
	errorHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	var configSent string
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/config") {
			var c client.UserGrafanaConfig
			require.NoError(t, json.NewDecoder(r.Body).Decode(&c))
			configSent = c.GrafanaAlertmanagerConfig
		}

		w.WriteHeader(http.StatusOK)
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
	require.NotEqual(t, testGrafanaConfig, encryptedConfig)

	// ApplyConfig performs a readiness check at startup.
	// A non-200 response should result in an error.
	server := httptest.NewServer(errorHandler)
	cfg := AlertmanagerConfig{
		OrgID:    1,
		TenantID: "test",
		URL:      server.URL,
	}

	ctx := context.Background()
	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(1, store)
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, "test"))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, "test"))

	// An error response from the remote Alertmanager should result in the readiness check failing.
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(cfg, fstore, secretsService.Decrypt, m)
	require.NoError(t, err)

	config := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: string(encryptedConfig),
	}
	require.Error(t, am.ApplyConfig(ctx, config))
	require.False(t, am.Ready())

	// A 200 status code response should make the check succeed.
	server.Config.Handler = okHandler
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.True(t, am.Ready())

	// Secrets in the sent configuration should be unencrypted.
	require.JSONEq(t, testGrafanaConfigWithSecret, configSent)

	// If we already got a 200 status code response, we shouldn't make the HTTP request again.
	server.Config.Handler = errorHandler
	require.NoError(t, am.ApplyConfig(ctx, config))
	require.True(t, am.Ready())
}

func TestCompareAndSendConfiguration(t *testing.T) {
	testValue := []byte("test")
	testErr := errors.New("test error")
	decryptFn := func(_ context.Context, payload []byte) ([]byte, error) {
		if string(payload) == string(testValue) {
			return testValue, nil
		}
		return nil, testErr
	}

	var got string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		OrgID:    1,
		TenantID: "test",
		URL:      server.URL,
	}
	am, err := NewAlertmanager(cfg,
		fstore,
		decryptFn,
		m,
	)
	require.NoError(t, err)

	tests := []struct {
		name   string
		config string
		expCfg *client.UserGrafanaConfig
		expErr string
	}{
		{
			"invalid config",
			"{}",
			nil,
			"unable to parse Alertmanager configuration: no route provided in config",
		},
		{
			"invalid base-64 in key",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, `"password":"!"`, 1),
			nil,
			"failed to decode value for key 'password': illegal base64 data at input byte 0",
		},
		{
			"decrypt error",
			testGrafanaConfigWithSecret,
			nil,
			fmt.Sprintf("failed to decrypt value for key 'password': %s", testErr.Error()),
		},
		{
			"no error",
			strings.Replace(testGrafanaConfigWithSecret, `"password":"test"`, fmt.Sprintf("%q:%q", "password", base64.StdEncoding.EncodeToString(testValue)), 1),
			&client.UserGrafanaConfig{
				GrafanaAlertmanagerConfig: testGrafanaConfigWithSecret,
			},
			"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := ngmodels.AlertConfiguration{
				AlertmanagerConfiguration: test.config,
			}
			err = am.CompareAndSendConfiguration(context.Background(), &cfg)
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

func TestIntegrationRemoteAlertmanagerApplyConfigOnlyUploadsOnce(t *testing.T) {
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
	}

	fakeConfigHash := fmt.Sprintf("%x", md5.Sum([]byte(testGrafanaConfig)))
	fakeConfigCreatedAt := time.Date(2020, 6, 5, 12, 6, 0, 0, time.UTC).Unix()
	fakeConfig := &ngmodels.AlertConfiguration{
		AlertmanagerConfiguration: testGrafanaConfig,
		ConfigurationHash:         fakeConfigHash,
		ConfigurationVersion:      "v2",
		CreatedAt:                 fakeConfigCreatedAt,
		Default:                   true,
		OrgID:                     1,
	}

	silences := []byte("test-silences")
	nflog := []byte("test-notifications")
	store := ngfakes.NewFakeKVStore(t)
	fstore := notifier.NewFileStore(cfg.OrgID, store)

	ctx := context.Background()
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.SilencesFilename, base64.StdEncoding.EncodeToString(silences)))
	require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", notifier.NotificationLogFilename, base64.StdEncoding.EncodeToString(nflog)))

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(cfg, fstore, secretsService.Decrypt, m)
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
		require.NoError(t, am.ApplyConfig(ctx, fakeConfig))

		// First, we need to verify that the readiness check passes.
		require.True(t, am.Ready())

		// Next, we need to verify that Mimir received both the configuration and state.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)
		require.Equal(t, testGrafanaConfig, config.GrafanaAlertmanagerConfig)
		require.Equal(t, fakeConfigHash, config.Hash)
		require.Equal(t, fakeConfigCreatedAt, config.CreatedAt)
		require.Equal(t, true, config.Default)

		state, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.NoError(t, err)
		require.Equal(t, encodedFullState, state.State)
	}

	// Calling `ApplyConfig` again with a changed configuration and state yields no effect.
	{
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "silences", base64.StdEncoding.EncodeToString([]byte("abc123"))))
		require.NoError(t, store.Set(ctx, cfg.OrgID, "alertmanager", "notifications", base64.StdEncoding.EncodeToString([]byte("abc123"))))
		fakeConfig.ID = 30000000000000000
		require.NoError(t, am.ApplyConfig(ctx, fakeConfig))

		// The remote Alertmanager continues to be ready.
		require.True(t, am.Ready())

		// Next, we need to verify that the config that was uploaded remains the same.
		config, err := am.mimirClient.GetGrafanaAlertmanagerConfig(ctx)
		require.NoError(t, err)
		require.Equal(t, testGrafanaConfig, config.GrafanaAlertmanagerConfig)
		require.Equal(t, fakeConfigHash, config.Hash)
		require.Equal(t, fakeConfigCreatedAt, config.CreatedAt)
		require.Equal(t, true, config.Default)

		// Check that the state is the same as before.
		state, err := am.mimirClient.GetGrafanaAlertmanagerState(ctx)
		require.NoError(t, err)
		require.Equal(t, encodedFullState, state.State)
	}

	// TODO: Now, shutdown the Alertmanager and we expect the latest configuration to be uploaded.
	{
	}
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
	}

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(cfg, nil, secretsService.Decrypt, m)
	require.NoError(t, err)

	// We should have no silences at first.
	silences, err := am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)
	require.Equal(t, 0, len(silences))

	// Creating a silence should succeed.
	testSilence := genSilence("test")
	id, err := am.CreateSilence(context.Background(), &testSilence)
	require.NoError(t, err)
	require.NotEmpty(t, id)
	testSilence.ID = id

	// We should be able to retrieve a specific silence.
	silence, err := am.GetSilence(context.Background(), testSilence.ID)
	require.NoError(t, err)
	require.Equal(t, testSilence.ID, *silence.ID)

	// Trying to retrieve a non-existing silence should fail.
	_, err = am.GetSilence(context.Background(), util.GenerateShortUID())
	require.Error(t, err)

	// After creating another silence, the total amount should be 2.
	testSilence2 := genSilence("test")
	id, err = am.CreateSilence(context.Background(), &testSilence2)
	require.NoError(t, err)
	require.NotEmpty(t, id)
	testSilence2.ID = id

	silences, err = am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)
	require.Equal(t, 2, len(silences))
	require.True(t, *silences[0].ID == testSilence.ID || *silences[0].ID == testSilence2.ID)
	require.True(t, *silences[1].ID == testSilence.ID || *silences[1].ID == testSilence2.ID)

	// After deleting one of those silences, the total amount should be 2 but one of those should be expired.
	err = am.DeleteSilence(context.Background(), testSilence.ID)
	require.NoError(t, err)

	silences, err = am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)

	for _, s := range silences {
		if *s.ID == testSilence.ID {
			require.Equal(t, *s.Status.State, "expired")
		} else {
			require.Equal(t, *s.Status.State, "pending")
		}
	}

	// When deleting the other silence, both should be expired.
	err = am.DeleteSilence(context.Background(), testSilence2.ID)
	require.NoError(t, err)

	silences, err = am.ListSilences(context.Background(), []string{})
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
	}

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(cfg, nil, secretsService.Decrypt, m)
	require.NoError(t, err)

	// Wait until the Alertmanager is ready to send alerts.
	require.NoError(t, am.checkReadiness(context.Background()))
	require.True(t, am.Ready())
	require.Eventually(t, func() bool {
		return len(am.sender.Alertmanagers()) > 0
	}, 10*time.Second, 500*time.Millisecond)

	// We should have no alerts and no groups at first.
	alerts, err := am.GetAlerts(context.Background(), true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 0, len(alerts))

	alertGroups, err := am.GetAlertGroups(context.Background(), true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 0, len(alertGroups))

	// Let's create two active alerts and one expired one.
	alert1 := genAlert(true, map[string]string{"test_1": "test_1"})
	alert2 := genAlert(true, map[string]string{"test_2": "test_2"})
	alert3 := genAlert(false, map[string]string{"test_3": "test_3"})
	postableAlerts := apimodels.PostableAlerts{
		PostableAlerts: []amv2.PostableAlert{alert1, alert2, alert3},
	}
	err = am.PutAlerts(context.Background(), postableAlerts)
	require.NoError(t, err)

	// We should have two alerts and one group now.
	require.Eventually(t, func() bool {
		alerts, err = am.GetAlerts(context.Background(), true, true, true, []string{}, "")
		require.NoError(t, err)
		return len(alerts) == 2
	}, 16*time.Second, 1*time.Second)

	alertGroups, err = am.GetAlertGroups(context.Background(), true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 1, len(alertGroups))

	// Filtering by `test_1=test_1` should return one alert.
	alerts, err = am.GetAlerts(context.Background(), true, true, true, []string{"test_1=test_1"}, "")
	require.NoError(t, err)
	require.Equal(t, 1, len(alerts))
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
	}

	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	m := metrics.NewRemoteAlertmanagerMetrics(prometheus.NewRegistry())
	am, err := NewAlertmanager(cfg, nil, secretsService.Decrypt, m)
	require.NoError(t, err)

	// We should start with the default config.
	rcvs, err := am.GetReceivers(context.Background())
	require.NoError(t, err)
	require.Equal(t, "empty-receiver", *rcvs[0].Name)
}

func genSilence(createdBy string) apimodels.PostableSilence {
	starts := strfmt.DateTime(time.Now().Add(time.Duration(rand.Int63n(9)+1) * time.Second))
	ends := strfmt.DateTime(time.Now().Add(time.Duration(rand.Int63n(9)+10) * time.Second))
	comment := "test comment"
	isEqual := true
	name := "test"
	value := "test"
	isRegex := false
	matchers := amv2.Matchers{&amv2.Matcher{IsEqual: &isEqual, Name: &name, Value: &value, IsRegex: &isRegex}}

	return apimodels.PostableSilence{
		Silence: amv2.Silence{
			Comment:   &comment,
			CreatedBy: &createdBy,
			Matchers:  matchers,
			StartsAt:  &starts,
			EndsAt:    &ends,
		},
	}
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
