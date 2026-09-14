package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestIntegrationStableSessionMigration(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	testDB, err := sqlutil.GetTestDB(sqlutil.GetTestDBType())
	require.NoError(t, err)
	t.Cleanup(testDB.Cleanup)
	engine, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, engine.Close()) })
	require.NoError(t, NewDialect(engine.DriverName()).CleanDB(engine))
	cfg := &setting.Cfg{Raw: ini.Empty()}
	old := NewMigrator(engine, cfg)
	old.AddCreateMigration()
	table := addUserAuthTokenV1Migrations(old)
	require.NoError(t, old.Start(false, 0))
	_, err = engine.Exec(`INSERT INTO user_auth_token
		(id, user_id, auth_token, prev_auth_token, user_agent, client_ip, auth_token_seen, seen_at, rotated_at, created_at, updated_at, revoked_at, external_session_id)
		VALUES (42, 7, 'current', 'previous', 'browser', '127.0.0.1', ?, 10, 20, 1, 20, 0, 99),
		(43, 7, 'revoked', 'previous-revoked', 'browser', '127.0.0.1', ?, 30, 20, 1, 20, 40, 100)`, true, true)
	require.NoError(t, err)

	migration := NewMigrator(engine, cfg)
	addStableSessionMigrations(migration, table)
	require.NoError(t, migration.Start(false, 0))
	var sessions []struct {
		ID                int64 `xorm:"id"`
		AuthToken         string
		SeenAt            int64
		CreatedAt         int64
		RevokedAt         int64
		ExternalSessionID int64 `xorm:"external_session_id"`
	}
	require.NoError(t, engine.Table("user_auth_token").Asc("id").Find(&sessions))
	require.Len(t, sessions, 2)
	require.Equal(t, int64(42), sessions[0].ID)
	require.Equal(t, "current", sessions[0].AuthToken)
	require.Equal(t, int64(20), sessions[0].SeenAt)
	require.Equal(t, int64(1), sessions[0].CreatedAt)
	require.Equal(t, int64(99), sessions[0].ExternalSessionID)
	require.Equal(t, int64(30), sessions[1].SeenAt)
	require.Equal(t, int64(40), sessions[1].RevokedAt)

	newSession := struct {
		ID        int64 `xorm:"id pk autoincr"`
		UserID    int64 `xorm:"user_id"`
		AuthToken string
		UserAgent string
		ClientIP  string `xorm:"client_ip"`
		SeenAt    int64
		CreatedAt int64
		UpdatedAt int64
	}{UserID: 7, AuthToken: "new", UserAgent: "browser", ClientIP: "127.0.0.1", SeenAt: 50, CreatedAt: 50, UpdatedAt: 50}
	_, err = engine.Table("user_auth_token").Insert(&newSession)
	require.NoError(t, err)
	require.Greater(t, newSession.ID, int64(43))
}
