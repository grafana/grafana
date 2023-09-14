package notifier

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewExternalAlertmanager(t *testing.T) {
	validConfig := `{"template_files":null,"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"email receiver","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
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
