package authinfoimpl

import (
	"context"
	"errors"
	"regexp"
	"sync"
	"testing"
	"text/template"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/login"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAuthInfoStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sql := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store, err := ProvideLegacyStore(context.Background(), legacysql.NewDatabaseProvider(sql), secretstest.NewFakeSecretsService())
	require.NoError(t, err)

	t.Run("should be able to auth lables for users", func(t *testing.T) {
		ctx := context.Background()
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.LDAPAuthModule,
			AuthId:     "1",
			UserId:     1,
			UserUID:    "1",
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.AzureADAuthModule,
			AuthId:     "1",
			UserId:     1,
			UserUID:    "1",
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.GoogleAuthModule,
			AuthId:     "10",
			UserId:     2,
			UserUID:    "2",
		}))

		labels, err := store.GetUsersRecentlyUsedLabel(ctx, login.GetUserLabelsQuery{UserIDs: []int64{1, 2}})
		require.NoError(t, err)
		require.Len(t, labels, 2)

		// There is no guarantee that user with user_id=1 gets "oauth_azuread" or "ldap".
		// Both are valid results for the query (basically SELECT * FROM `user_auth` WHERE `user_id` IN (1,2) ORDER BY created),
		// Some databases may randomize its output, so test cannot rely on the ordering (other than "Created" column, which is equal here).
		require.True(t, labels[1] == login.AzureADAuthModule || labels[1] == login.LDAPAuthModule)
		require.Equal(t, login.GoogleAuthModule, labels[2])
	})

	t.Run("should always get the latest used", func(t *testing.T) {
		ctx := context.Background()
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.LDAPAuthModule,
			AuthId:     "1",
			UserId:     1,
			UserUID:    "1",
		}))

		defer func() {
			GetTime = time.Now
		}()

		GetTime = func() time.Time {
			return time.Now().Add(1 * time.Hour)
		}

		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.AzureADAuthModule,
			AuthId:     "2",
			UserId:     1,
			UserUID:    "1",
		}))

		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId: 1,
		})
		require.NoError(t, err)

		assert.Equal(t, login.AzureADAuthModule, info.AuthModule)
		assert.Equal(t, "2", info.AuthId)
	})

	t.Run("should return error when userID and authID is zero value", func(t *testing.T) {
		ctx := context.Background()
		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			AuthModule: login.GoogleAuthModule,
		})

		require.ErrorIs(t, err, user.ErrUserNotFound)
		require.Nil(t, info)
	})

	t.Run("should delete only the targeted auth module", func(t *testing.T) {
		ctx := context.Background()
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.LDAPAuthModule,
			AuthId:     "20",
			UserId:     20,
			UserUID:    "20",
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.AzureADAuthModule,
			AuthId:     "20",
			UserId:     20,
			UserUID:    "20",
		}))

		require.NoError(t, store.DeleteAuthInfo(ctx, &login.DeleteAuthInfoCommand{
			UserAuth: &login.UserAuth{UserId: 20, AuthModule: login.LDAPAuthModule},
		}))

		require.Equal(t, 0, countEntries(t, sql, login.LDAPAuthModule, "20", 20))
		require.Equal(t, 1, countEntries(t, sql, login.AzureADAuthModule, "20", 20))
	})

	t.Run("should remove duplicates on update", func(t *testing.T) {
		ctx := context.Background()
		setCmd := &login.SetAuthInfoCommand{
			AuthModule: login.GenericOAuthModule,
			AuthId:     "1",
			UserId:     10,
			UserUID:    "10",
		}

		require.NoError(t, store.SetAuthInfo(ctx, setCmd))
		require.NoError(t, store.SetAuthInfo(ctx, setCmd))

		count := countEntries(t, sql, setCmd.AuthModule, setCmd.AuthId, setCmd.UserId)
		require.Equal(t, 2, count)

		err := store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
			AuthModule: setCmd.AuthModule,
			AuthId:     setCmd.AuthId,
			UserId:     setCmd.UserId,
			OAuthToken: &oauth2.Token{
				AccessToken:  "atoken",
				RefreshToken: "rtoken",
				Expiry:       time.Now(),
			},
		})
		require.NoError(t, err)

		count = countEntries(t, sql, setCmd.AuthModule, setCmd.AuthId, setCmd.UserId)
		require.Equal(t, 1, count)
	})
}

var registerAuthInfoSQLMockXormDriverOnce sync.Once

type authInfoSQLMockXormDriver struct{}

func (authInfoSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockAuthInfoDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockAuthInfoDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockAuthInfoDB) WithTransactionalDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.withSession(callback)
}

func (d *sqlmockAuthInfoDB) withSession(callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockAuthInfoDB) GetDBType() core.DbType {
	return core.SQLITE
}

func TestStoreUsesProviderTables(t *testing.T) {
	registerAuthInfoSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", authInfoSQLMockXormDriver{})
		}
	})

	dsn := "authinfo-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockAuthInfoDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	calls := 0
	tables := make([]string, 0, 4)
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				tables = append(tables, name)
				return "test_schema." + name
			},
		}, nil
	}

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "test_schema"."user_auth"`)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	store, err := ProvideLegacyStore(ctx, provider, secretstest.NewFakeSecretsService())
	require.NoError(t, err)

	mock.ExpectQuery(regexp.QuoteMeta("FROM `test_schema`.`user_auth`")).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"auth_module"}).AddRow(login.LDAPAuthModule))
	modules, err := store.GetUserAuthModules(ctx, 42)
	require.NoError(t, err)
	require.Equal(t, []string{login.LDAPAuthModule}, modules)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."user_auth" WHERE user_id = ?`)).
		WithArgs(int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.DeleteUserAuthInfo(ctx, 42))

	mock.ExpectExec(regexp.QuoteMeta("UPDATE `test_schema`.`user_auth`")).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id FROM "test_schema"."user_auth"`)).
		WithArgs(int64(42), login.LDAPAuthModule, "auth-id").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(8)))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."user_auth"`)).
		WithArgs(int64(42), login.LDAPAuthModule, "auth-id", int64(8)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     42,
		AuthModule: login.LDAPAuthModule,
		AuthId:     "auth-id",
	}))

	require.Equal(t, 4, calls)
	require.Equal(t, []string{"user_auth", "user", "user_auth", "user_auth", "user_auth", "user_auth", "user_auth"}, tables)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	userAuthTable := dbHelper.Table("user_auth")
	userTable := dbHelper.Table("user")
	queryTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			lookupDuplicateUserAuthTemplate: {
				{
					Name: "lookup_duplicate",
					Data: lookupDuplicateUserAuthQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
						AuthModule:    "ldap",
						AuthID:        "auth-id",
					},
				},
			},
			deleteDuplicateUserAuthTemplate: {
				{
					Name: "delete_duplicate",
					Data: deleteDuplicateUserAuthQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
						AuthModule:    "ldap",
						AuthID:        "auth-id",
						ID:            8,
					},
				},
			},
			deleteUserAuthTemplate: {
				{
					Name: "delete_user_auth",
					Data: deleteUserAuthQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
					},
				},
			},
			deleteAuthInfoTemplate: {
				{
					Name: "delete_auth_info",
					Data: deleteAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
						AuthModule:    "ldap",
					},
				},
			},
			userAuthUIDMigrationTemplate: {
				{
					Name: "migrate_user_uid",
					Data: userAuthUIDMigrationQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserTable:     userTable,
					},
				},
			},
		},
	})
}

func countEntries(t *testing.T, sql db.DB, authModule, authID string, userID int64) int {
	var result int

	err := sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.SQL(
			"SELECT COUNT(*) FROM user_auth WHERE auth_module = ? AND auth_id = ? AND user_id = ?",
			authModule, authID, userID,
		).Get(&result)
		return err
	})

	require.NoError(t, err)
	return result
}

func TestStore_GetUsersAuthModules(t *testing.T) {
	registerAuthInfoSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", authInfoSQLMockXormDriver{})
		}
	})
	for _, tt := range []struct {
		name       string
		userIDs    []int64
		queryError bool
	}{
		{name: "groups and deduplicates modules", userIDs: []int64{42, 43, 44}},
		{name: "empty input"},
		{name: "query error", userIDs: []int64{42, 43, 44}, queryError: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			mockDB, mock, err := sqlmock.NewWithDSN(t.Name())
			require.NoError(t, err)
			t.Cleanup(func() { _ = mockDB.Close() })
			engine, err := xorm.NewEngine("sqlmock", t.Name())
			require.NoError(t, err)
			t.Cleanup(func() { _ = engine.Close() })
			calls, tableCalls := 0, 0
			ctx := t.Context()
			store := &Store{sql: func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				require.Equal(t, ctx, gotCtx)
				calls++
				return &legacysql.LegacyDatabaseHelper{DB: &sqlmockAuthInfoDB{engine: engine}, Table: func(name string) string {
					require.Equal(t, "user_auth", name)
					tableCalls++
					return "test_schema." + name
				}}, nil
			}}
			wantErr := errors.New("auth query failed")
			if len(tt.userIDs) > 0 {
				query := mock.ExpectQuery("^"+regexp.QuoteMeta("SELECT `user_id`, `auth_module` FROM `test_schema`.`user_auth` WHERE `user_id` IN (?,?,?) ORDER BY `created` DESC")+"$").WithArgs(int64(42), int64(43), int64(44))
				if tt.queryError {
					query.WillReturnError(wantErr)
				} else {
					query.WillReturnRows(sqlmock.NewRows([]string{"user_id", "auth_module"}).AddRow(42, "ldap").AddRow(43, "oauth_github").AddRow(42, "ldap").AddRow(42, "oauth_generic_oauth"))
				}
			}
			modules, err := store.GetUsersAuthModules(ctx, tt.userIDs)
			if tt.queryError {
				require.ErrorIs(t, err, wantErr)
				require.Nil(t, modules)
			} else {
				require.NoError(t, err)
				if len(tt.userIDs) == 0 {
					require.Empty(t, modules)
				} else {
					require.Equal(t, map[int64][]string{42: {"ldap", "oauth_generic_oauth"}, 43: {"oauth_github"}}, modules)
					require.NotContains(t, modules, int64(44))
				}
			}
			wantCalls := 0
			if len(tt.userIDs) > 0 {
				wantCalls = 1
			}
			require.Equal(t, wantCalls, calls)
			require.Equal(t, wantCalls, tableCalls)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
