package notifier

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func setupAMTest(t *testing.T) *Alertmanager {
	dir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath: dir,
		AppURL:   "http://localhost:9093",
	}

	m := metrics.NewAlertmanagerMetrics(prometheus.NewRegistry())
	sqlStore := db.InitTestDB(t)
	s := &store.DBstore{
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval:                  10 * time.Second,
			DefaultRuleEvaluationInterval: time.Minute,
		},
		SQLStore:         sqlStore,
		Logger:           log.New("alertmanager-test"),
		DashboardService: dashboards.NewFakeDashboardService(t),
	}

	kvStore := NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	decryptFn := secretsService.GetDecryptedValue
	am, err := newAlertmanager(context.Background(), 1, cfg, s, kvStore, &NilPeer{}, decryptFn, nil, m)
	require.NoError(t, err)
	return am
}

func TestAlertmanager_newAlertmanager(t *testing.T) {
	am := setupAMTest(t)
	require.False(t, am.Ready())
}
