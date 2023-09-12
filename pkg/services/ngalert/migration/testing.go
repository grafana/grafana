package migration

import (
	"testing"

	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// newTestMigration generates an empty migration to use in tests.
func newTestMigration(t *testing.T) *migration {
	t.Helper()

	return &migration{
		log: &logtest.Fake{},
		seenUIDs: uidSet{
			set: make(map[string]struct{}),
		},
		silences:          make(map[int64][]*silencepb.MeshSilence),
		encryptionService: fake_secrets.NewFakeSecretsService(),
	}
}

func NewTestMigrationService(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *MigrationService {
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
