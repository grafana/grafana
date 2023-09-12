package notifier

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSaveAndApplyConfig(t *testing.T) {
	externalAM := NewFakeExternalAlertmanager(t, "1", "test")
	defer externalAM.Close()

	cfg := ExternalAlertmanagerConfig{
		URL:               externalAM.Server.URL,
		TenantID:          externalAM.tenantID,
		BasicAuthPassword: externalAM.password,
	}
	am, err := newExternalAlertmanager(cfg, 1)
	require.NoError(t, err)

	newConfigString := `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
	newConfig, err := Load([]byte(newConfigString))
	require.NoError(t, err)
	require.NotEqual(t, newConfig.AlertmanagerConfig, externalAM.config.AlertmanagerConfig)
	require.NotEqual(t, newConfig.TemplateFiles, externalAM.config.TemplateFiles)

	err = am.SaveAndApplyConfig(context.Background(), newConfig)
	require.NoError(t, err)

	require.Equal(t, newConfig.AlertmanagerConfig, externalAM.config.AlertmanagerConfig)
	require.Equal(t, newConfig.TemplateFiles, externalAM.config.TemplateFiles)
}
