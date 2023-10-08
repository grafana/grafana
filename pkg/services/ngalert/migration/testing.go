package migration

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func NewTestMigrationService(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *MigrationService {
	if cfg == nil {
		cfg = setting.NewCfg()
	}
	ms, err := ProvideService(
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		cfg,
		sqlStore,
		migrationStore.NewTestMigrationStore(t, sqlStore, cfg),
		fake_secrets.NewFakeSecretsService(),
	)
	require.NoError(t, err)
	return ms
}
