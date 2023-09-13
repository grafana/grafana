package notifier

import (
	"context"
	"testing"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestSaveAndApplyConfig(t *testing.T) {
	externalAM := NewFakeExternalAlertmanager(t, "1", "test")
	defer externalAM.Close()

	configStore := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{
		1: {AlertmanagerConfiguration: setting.GetAlertmanagerDefaultConfiguration(), OrgID: 1},
	})

	cfg := ExternalAlertmanagerConfig{
		URL:               externalAM.Server.URL,
		TenantID:          externalAM.tenantID,
		BasicAuthPassword: externalAM.password,
	}
	am, err := newExternalAlertmanager(cfg, 1, configStore)
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

func TestSaveAndApplyDefaultConfig(t *testing.T) {
	externalAM := NewFakeExternalAlertmanager(t, "1", "test")
	defer externalAM.Close()

	configStore := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{
		1: {AlertmanagerConfiguration: setting.GetAlertmanagerDefaultConfiguration(), OrgID: 1},
	})

	defaultConfig := `{"template_files":{},"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"email receiver","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
	cfg := ExternalAlertmanagerConfig{
		URL:               externalAM.Server.URL,
		TenantID:          externalAM.tenantID,
		BasicAuthPassword: externalAM.password,
		DefaultConfig:     defaultConfig,
	}
	am, err := newExternalAlertmanager(cfg, 1, configStore)
	require.NoError(t, err)

	err = am.SaveAndApplyDefaultConfig(context.Background())
	require.NoError(t, err)

	exp, err := Load([]byte(defaultConfig))
	require.NoError(t, err)
	require.Equal(t, exp.AlertmanagerConfig, externalAM.config.AlertmanagerConfig)
	require.Equal(t, exp.TemplateFiles, externalAM.config.TemplateFiles)
}
