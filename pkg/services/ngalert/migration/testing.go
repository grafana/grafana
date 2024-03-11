package migration

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func NewTestMigrationService(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *migrationService {
	t.Helper()
	if cfg == nil {
		cfg = setting.NewCfg()
	}

	svc, err := ProvideService(
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		cfg,
		featuremgmt.WithFeatures(),
		sqlStore,
		migrationStore.NewTestMigrationStore(t, sqlStore, cfg),
		fake_secrets.NewFakeSecretsService(),
	)
	require.NoError(t, err)
	return svc.(*migrationService)
}
