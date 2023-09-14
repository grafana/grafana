package notifier

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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
			expErr:        "empty URL",
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
			am, err := newExternalAlertmanager(cfg, test.orgID, nil)
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

func TestApplyConfig(t *testing.T) {
	fakeAm := NewFakeExternalAlertmanager(t, "1", "password")
	validAlertConfiguration := models.AlertConfiguration{
		AlertmanagerConfiguration: validConfig,
	}

	tests := []struct {
		name     string
		config   models.AlertConfiguration
		url      string
		tenantID string
		password string
		expErr   string
	}{
		{
			"missing password",
			validAlertConfiguration,
			fakeAm.Server.URL,
			fakeAm.tenantID,
			"",
			"setting config failed with status code 401",
		},
		{
			"incorrect password",
			validAlertConfiguration,
			fakeAm.Server.URL,
			fakeAm.tenantID,
			"incorrect",
			"setting config failed with status code 403",
		},
		{
			"incorrect tenantID",
			validAlertConfiguration,
			fakeAm.Server.URL,
			"incorrect",
			fakeAm.password,
			"setting config failed with status code 403",
		},
		{
			"invalid configuration",
			models.AlertConfiguration{
				AlertmanagerConfiguration: "",
			},
			fakeAm.Server.URL,
			fakeAm.tenantID,
			fakeAm.password,
			"unable to parse Alertmanager configuration: unexpected end of JSON input",
		},
		{
			"empty configuration",
			models.AlertConfiguration{
				AlertmanagerConfiguration: "invalid",
			},
			fakeAm.Server.URL,
			fakeAm.tenantID,
			fakeAm.password,
			"unable to parse Alertmanager configuration: invalid character 'i' looking for beginning of value",
		},
		{
			"trailing forward slash",
			validAlertConfiguration,
			fakeAm.Server.URL + "/",
			fakeAm.tenantID,
			fakeAm.password,
			"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := externalAlertmanagerConfig{
				URL:               test.url,
				TenantID:          test.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     validConfig,
			}
			am, err := newExternalAlertmanager(cfg, 1, nil)
			require.NoError(tt, err)

			err = am.ApplyConfig(context.Background(), &test.config)
			if test.expErr != "" {
				require.EqualError(tt, err, test.expErr)
				return
			}
			require.NoError(tt, err)
		})
	}
}

func TestSaveAndApplyConfig(t *testing.T) {
	fakeAm := NewFakeExternalAlertmanager(t, "1", "password")
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		1: {
			AlertmanagerConfiguration: validConfig,
			OrgID:                     1,
		},
	})
	validPostableConfig, err := Load([]byte(validConfig))
	require.NoError(t, err)

	tests := []struct {
		name      string
		config    *definitions.PostableUserConfig
		password  string
		expConfig string
		expErr    string
	}{
		{
			"error posting config",
			validPostableConfig,
			"invalid",
			"",
			"setting config failed with status code 403",
		},
		{
			"configuration saved and applied",
			validPostableConfig,
			fakeAm.password,
			validConfig,
			"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := externalAlertmanagerConfig{
				URL:               fakeAm.Server.URL,
				TenantID:          fakeAm.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     validConfig,
			}
			am, err := newExternalAlertmanager(cfg, 1, configStore)
			require.NoError(tt, err)

			err = am.SaveAndApplyConfig(context.Background(), test.config)
			if test.expErr != "" {
				require.EqualError(tt, err, test.expErr)
				return
			}
			require.NoError(tt, err)

			savedConfig, ok := configStore.configs[1]
			require.True(tt, ok)
			require.Equal(tt, test.expConfig, savedConfig.AlertmanagerConfiguration)
		})
	}
}

func TestSaveAndApplyDefaultConfig(t *testing.T) {
	fakeAm := NewFakeExternalAlertmanager(t, "1", "password")
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		1: {
			AlertmanagerConfiguration: validConfig,
			OrgID:                     1,
		},
	})

	tests := []struct {
		name          string
		defaultConfig string
		password      string
		expErr        string
	}{
		{
			"error posting config",
			validConfig,
			"invalid",
			"setting config failed with status code 403",
		},
		{
			"default configuration saved and applied",
			validConfig,
			fakeAm.password,
			"",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			cfg := externalAlertmanagerConfig{
				URL:               fakeAm.Server.URL,
				TenantID:          fakeAm.tenantID,
				BasicAuthPassword: test.password,
				DefaultConfig:     test.defaultConfig,
			}
			am, err := newExternalAlertmanager(cfg, 1, configStore)
			require.NoError(tt, err)

			err = am.SaveAndApplyDefaultConfig(context.Background())
			if test.expErr != "" {
				require.EqualError(tt, err, test.expErr)
				return
			}
			require.NoError(tt, err)

			savedConfig, ok := configStore.configs[1]
			require.True(tt, ok)
			require.Equal(tt, am.defaultConfig, savedConfig.AlertmanagerConfiguration)
		})
	}
}
