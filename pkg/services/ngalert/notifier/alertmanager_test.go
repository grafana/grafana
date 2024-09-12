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
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupAMTest(t *testing.T) *alertmanager {
	dir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath: dir,
		AppURL:   "http://localhost:9093",
	}

	l := log.New("alertmanager-test")

	m := metrics.NewAlertmanagerMetrics(prometheus.NewRegistry(), l)
	sqlStore := db.InitTestDB(t)
	s := &store.DBstore{
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval:                  10 * time.Second,
			DefaultRuleEvaluationInterval: time.Minute,
		},
		SQLStore:         sqlStore,
		Logger:           l,
		DashboardService: dashboards.NewFakeDashboardService(t),
	}

	kvStore := fakes.NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	decryptFn := secretsService.GetDecryptedValue

	orgID := 1
	stateStore := NewFileStore(int64(orgID), kvStore)

	am, err := NewAlertmanager(context.Background(), 1, cfg, s, stateStore, &NilPeer{}, decryptFn, nil, m, false)
	require.NoError(t, err)
	return am
}

func TestAlertmanager_newAlertmanager(t *testing.T) {
	am := setupAMTest(t)
	require.False(t, am.Ready())
}
