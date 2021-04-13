package notifier

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAlertmanager_ShouldUseDefaultConfigurationWhenNoConfiguration(t *testing.T) {
	am := &Alertmanager{
		Settings: &setting.Cfg{},
		SQLStore: sqlstore.InitTestDB(t),
	}
	require.NoError(t, am.Init())
	require.NoError(t, am.SyncAndApplyConfigFromDatabase())
	require.NotNil(t, am.config)
}
