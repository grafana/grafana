package notifier

import (
	"context"
	"testing"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	amfake "github.com/grafana/grafana/pkg/services/ngalert/notifier/fake"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/stretchr/testify/require"
)

const validConfig = `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`

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
			cfg := externalAlertmanagerConfig{
				URL:               test.url,
				TenantID:          test.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     test.defaultConfig,
			}
			am, err := newExternalAlertmanager(cfg, test.orgID)
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

func TestSilences(t *testing.T) {
	const (
		tenantID = "1"
		password = "password"
	)
	fakeAm := amfake.NewFakeExternalAlertmanager(t, tenantID, password)

	// Using a wrong password should cause an error.
	cfg := externalAlertmanagerConfig{
		URL:               fakeAm.Server.URL + "/alertmanager",
		TenantID:          tenantID,
		BasicAuthPassword: "wrongpassword",
		DefaultConfig:     validConfig,
	}
	am, err := newExternalAlertmanager(cfg, 1)
	require.NoError(t, err)

	_, err = am.ListSilences(context.Background(), []string{})
	require.NotNil(t, err)

	// Using the correct password should make the request succeed.
	cfg.BasicAuthPassword = password
	am, err = newExternalAlertmanager(cfg, 1)
	require.NoError(t, err)

	// We should have no silences at first.
	silences, err := am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)
	require.Equal(t, 0, len(silences))

	// Creating a silence should succeed.
	testSilence := createSilence("test comment", "1", amv2.Matchers{}, strfmt.NewDateTime(), strfmt.NewDateTime())
	silenceID, err := am.CreateSilence(context.Background(), &testSilence)
	require.NoError(t, err)
	require.NotEmpty(t, silenceID)

	// We should be able to retrieve a specific silence.
	silence, err := am.GetSilence(context.Background(), silenceID)
	require.NoError(t, err)
	require.Equal(t, *testSilence.Comment, *silence.Comment)
	require.Equal(t, *testSilence.CreatedBy, *silence.CreatedBy)
	require.Equal(t, *testSilence.StartsAt, *silence.StartsAt)
	require.Equal(t, *testSilence.EndsAt, *silence.EndsAt)
	require.Equal(t, testSilence.Matchers, silence.Matchers)

	// Trying to retrieve a non-existing silence should fail.
	_, err = am.GetSilence(context.Background(), "invalid")
	require.Error(t, err)

	// After creating another silence, the total amount should be 2.
	testSilence2 := createSilence("another test comment", "1", amv2.Matchers{}, strfmt.NewDateTime(), strfmt.NewDateTime())
	silenceID2, err := am.CreateSilence(context.Background(), &testSilence2)
	require.NoError(t, err)
	require.NotEmpty(t, silenceID2)

	silences, err = am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)
	require.Equal(t, 2, len(silences))
	require.True(t, *silences[0].ID == silenceID || *silences[0].ID == silenceID2)
	require.True(t, *silences[1].ID == silenceID || *silences[1].ID == silenceID2)

	// After deleting one of those silences, the total amount should be 2.
	err = am.DeleteSilence(context.Background(), silenceID)
	require.NoError(t, err)

	silences, err = am.ListSilences(context.Background(), []string{})
	require.NoError(t, err)
	require.Equal(t, 1, len(silences))

	// Trying to delete the same error should fail.
	err = am.DeleteSilence(context.Background(), silenceID)
	require.NotNil(t, err)
}

func createSilence(comment, createdBy string, matchers amv2.Matchers, startsAt, endsAt strfmt.DateTime) apimodels.PostableSilence {
	return apimodels.PostableSilence{
		Silence: amv2.Silence{
			Comment:   &comment,
			CreatedBy: &createdBy,
			Matchers:  matchers,
			StartsAt:  &startsAt,
			EndsAt:    &endsAt,
		},
	}
}
