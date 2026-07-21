package authimpl

import (
	"context"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerAuthSQLMockDriverOnce sync.Once

type authSQLMockDriver struct{}

func (authSQLMockDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type authSQLMockDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *authSQLMockDB) WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *authSQLMockDB) GetDBType() core.DbType  { return core.SQLITE }
func (d *authSQLMockDB) GetEngine() *xorm.Engine { return d.engine }

type runtimeContextKey struct{}

func newRuntimeSQLTest(t *testing.T) (sqlmock.Sqlmock, legacysql.LegacyDatabaseProvider) {
	t.Helper()
	registerAuthSQLMockDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", authSQLMockDriver{})
		}
	})

	dsn := t.Name()
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })
	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	engine.DatabaseTZ = time.UTC
	t.Cleanup(func() { _ = engine.Close() })

	providerCalls := 0
	provider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "request-context", ctx.Value(runtimeContextKey{}))
		providerCalls++
		return &legacysql.LegacyDatabaseHelper{
			DB: &authSQLMockDB{engine: engine},
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}
	t.Cleanup(func() { require.Equal(t, 1, providerCalls) })
	return mock, provider
}

func TestRuntimeSQLUsesRequestProviderAndQualifiedTables(t *testing.T) {
	ctx := context.WithValue(context.Background(), runtimeContextKey{}, "request-context")

	t.Run("token query", func(t *testing.T) {
		mock, provider := newRuntimeSQLTest(t)
		query := `SELECT "id", "user_id", "auth_token", "prev_auth_token", "user_agent", "client_ip", "auth_token_seen", "seen_at", "rotated_at", "created_at", "updated_at", "revoked_at", "external_session_id" FROM "test_schema"."user_auth_token"
WHERE "id" = ? AND "user_id" = ?;`
		mock.ExpectQuery(regexp.QuoteMeta(query)).WithArgs(int64(11), int64(22)).WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).AddRow(11, 22))
		svc := &UserAuthTokenService{sql: provider, tracer: tracing.InitializeTracerForTest()}
		token, err := svc.GetUserToken(ctx, 22, 11)
		require.NoError(t, err)
		require.Equal(t, int64(11), token.Id)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("token lookup repeats the hash argument", func(t *testing.T) {
		mock, provider := newRuntimeSQLTest(t)
		cfgProvider, err := configprovider.ProvideService(&setting.Cfg{SecretKey: "secret"})
		require.NoError(t, err)
		hashedToken := hashToken("secret", "plain-token")
		query := `SELECT "id", "user_id", "auth_token", "prev_auth_token", "user_agent", "client_ip", "auth_token_seen", "seen_at", "rotated_at", "created_at", "updated_at", "revoked_at", "external_session_id"
FROM "test_schema"."user_auth_token"
WHERE ("auth_token" = ? OR "prev_auth_token" = ?);`
		mock.ExpectQuery(regexp.QuoteMeta(query)).WithArgs(hashedToken, hashedToken).WillReturnRows(
			sqlmock.NewRows([]string{"id", "user_id", "auth_token", "prev_auth_token", "revoked_at"}).AddRow(11, 22, hashedToken, hashedToken, 1),
		)
		svc := &UserAuthTokenService{sql: provider, cfgProvider: cfgProvider, log: log.NewNopLogger(), tracer: tracing.InitializeTracerForTest()}
		_, err = svc.LookupToken(ctx, "plain-token")
		require.Error(t, err)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("external session query", func(t *testing.T) {
		mock, provider := newRuntimeSQLTest(t)
		query := `SELECT "id", "user_id", "user_auth_id", "auth_module", "access_token", "id_token", "refresh_token", "session_id", "session_id_hash", "name_id", "name_id_hash", "expires_at", "created_at" FROM "test_schema"."user_external_session" WHERE "id" = ?;`
		mock.ExpectQuery(regexp.QuoteMeta(query)).WithArgs(int64(9)).WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(9))
		store := provideExternalSessionStore(provider, fakes.NewFakeSecretsService(), tracing.InitializeTracerForTest())
		session, err := store.Get(ctx, 9)
		require.NoError(t, err)
		require.Equal(t, int64(9), session.ID)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("cleanup query", func(t *testing.T) {
		mock, provider := newRuntimeSQLTest(t)
		now := time.Date(2026, 7, 21, 12, 0, 0, 0, time.UTC)
		oldGetTime := getTime
		getTime = func() time.Time { return now }
		t.Cleanup(func() { getTime = oldGetTime })
		query := `DELETE FROM "test_schema"."user_auth_token" WHERE "created_at" <= ? OR "rotated_at" <= ?;`
		mock.ExpectExec(regexp.QuoteMeta(query)).WithArgs(now.Add(-2*time.Hour).Unix(), now.Add(-time.Hour).Unix()).WillReturnResult(sqlmock.NewResult(0, 3))
		svc := &UserAuthTokenService{sql: provider, log: log.NewNopLogger()}
		affected, err := svc.deleteExpiredTokens(ctx, time.Hour, 2*time.Hour)
		require.NoError(t, err)
		require.Equal(t, int64(3), affected)
		require.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("orphan query", func(t *testing.T) {
		mock, provider := newRuntimeSQLTest(t)
		query := `DELETE FROM "test_schema"."user_external_session"
WHERE NOT EXISTS (
  SELECT 1 FROM "test_schema"."user_auth_token" AS "token"
  WHERE "user_external_session"."id" = "token"."external_session_id"
);`
		mock.ExpectExec(regexp.QuoteMeta(query)).WillReturnResult(sqlmock.NewResult(0, 1))
		svc := &UserAuthTokenService{sql: provider, log: log.NewNopLogger()}
		require.NoError(t, svc.deleteOrphanedExternalSessions(ctx))
		require.NoError(t, mock.ExpectationsWereMet())
	})
}
