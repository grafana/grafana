package remote

import (
	"context"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/stretchr/testify/require"
)

const (
	validConfig = `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`

	// Valid config for Cloud AM, no `grafana_managed_receievers` field.
	upstreamConfig = `{"template_files": {}, "alertmanager_config": "{\"global\": {\"smtp_from\": \"test@test.com\"}, \"route\": {\"receiver\": \"discord\"}, \"receivers\": [{\"name\": \"discord\", \"discord_configs\": [{\"webhook_url\": \"http://localhost:1234\"}]}]}"}`
)

func TestNewExternalAlertmanager(t *testing.T) {
	tests := []struct {
		name          string
		url           string
		tenantID      string
		password      string
		orgID         int64
		defaultConfig string
		expErr        string
	}{
		{
			name:          "empty URL",
			url:           "",
			tenantID:      "1234",
			password:      "test",
			defaultConfig: validConfig,
			orgID:         1,
			expErr:        "empty URL for tenant 1234",
		},
		{
			name:          "empty default config",
			url:           "http://localhost:8080",
			tenantID:      "1234",
			defaultConfig: "",
			password:      "test",
			orgID:         1,
			expErr:        "unable to parse Alertmanager configuration: unexpected end of JSON input",
		},
		{
			name:          "invalid default config",
			url:           "http://localhost:8080",
			tenantID:      "1234",
			defaultConfig: `{"invalid": true}`,
			password:      "test",
			orgID:         1,
			expErr:        "unable to parse Alertmanager configuration: no route provided in config",
		},
		{
			name:          "valid parameters",
			url:           "http://localhost:8080",
			tenantID:      "1234",
			defaultConfig: validConfig,
			password:      "test",
			orgID:         1,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := ExternalAlertmanagerConfig{
				URL:               test.url,
				TenantID:          test.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     test.defaultConfig,
			}
			am, err := NewExternalAlertmanager(cfg, test.orgID)
			if test.expErr != "" {
				require.EqualError(tt, err, test.expErr)
				return
			}

			require.NoError(tt, err)
			require.Equal(tt, am.tenantID, test.tenantID)
			require.Equal(tt, am.url, test.url)
			require.Equal(tt, am.defaultConfig, test.defaultConfig)
			require.Equal(tt, am.OrgID(), test.orgID)
			require.NotNil(tt, am.amClient)
			require.NotNil(tt, am.httpClient)
		})
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

	cfg := ExternalAlertmanagerConfig{
		URL:               amURL + "/alertmanager",
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     validConfig,
	}
	am, err := NewExternalAlertmanager(cfg, 1)
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

	cfg := ExternalAlertmanagerConfig{
		URL:               amURL + "/alertmanager",
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     validConfig,
	}
	am, err := NewExternalAlertmanager(cfg, 1)
	require.NoError(t, err)

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
	alerts, err = am.GetAlerts(context.Background(), true, true, true, []string{}, "")
	require.NoError(t, err)
	require.Equal(t, 2, len(alerts))

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

	cfg := ExternalAlertmanagerConfig{
		URL:               amURL + "/alertmanager",
		TenantID:          tenantID,
		BasicAuthPassword: password,
		DefaultConfig:     validConfig,
	}

	am, err := NewExternalAlertmanager(cfg, 1)
	require.NoError(t, err)

	// We should start with the default config.
	rcvs, err := am.GetReceivers(context.Background())
	require.NoError(t, err)
	require.Equal(t, "empty-receiver", *rcvs[0].Name)

	// After changing the configuration, we should have a new `discord` receiver.
	require.NoError(t, am.postConfig(context.Background(), upstreamConfig))
	require.Eventually(t, func() bool {
		rcvs, err = am.GetReceivers(context.Background())
		require.NoError(t, err)
		return *rcvs[0].Name == "discord"
	}, 16*time.Second, 1*time.Second)
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
