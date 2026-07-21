package authinfoimpl

import (
	"context"
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

	sql := db.InitTestDB(t)
	store, err := ProvideStore(context.Background(), legacysql.NewDatabaseProvider(sql), secretstest.NewFakeSecretsService())
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
		// Both are valid results for the query (SELECT user_id, auth_module FROM `user_auth` WHERE `user_id` IN (1,2) ORDER BY created),
		// Some databases may randomize its output, so test cannot rely on the ordering (other than "Created" column, which is equal here).
		require.True(t, labels[1] == login.AzureADAuthModule || labels[1] == login.LDAPAuthModule)
		require.Equal(t, login.GoogleAuthModule, labels[2])
	})

	t.Run("should return no labels when no user IDs are supplied", func(t *testing.T) {
		labels, err := store.GetUsersRecentlyUsedLabel(context.Background(), login.GetUserLabelsQuery{})
		require.NoError(t, err)
		require.Empty(t, labels)
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

	t.Run("should update auth identity fields", func(t *testing.T) {
		ctx := context.Background()
		originalGetTime := GetTime
		t.Cleanup(func() { GetTime = originalGetTime })

		created := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
		updated := created.Add(time.Hour)
		GetTime = func() time.Time { return created }
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule:  login.SAMLAuthModule,
			AuthId:      "old-auth-id",
			UserId:      20,
			UserUID:     "20",
			ExternalUID: "old-external-uid",
		}))

		GetTime = func() time.Time { return updated }
		require.NoError(t, store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
			AuthModule:  login.SAMLAuthModule,
			AuthId:      "new-auth-id",
			UserId:      20,
			ExternalUID: "new-external-uid",
		}))

		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId:     20,
			AuthModule: login.SAMLAuthModule,
		})
		require.NoError(t, err)
		require.Equal(t, "new-auth-id", info.AuthId)
		require.Equal(t, "new-external-uid", info.ExternalUID)
		require.Equal(t, updated, info.Created)
	})

	t.Run("should store auth timestamps in UTC", func(t *testing.T) {
		ctx := context.Background()
		originalGetTime := GetTime
		t.Cleanup(func() { GetTime = originalGetTime })

		location := time.FixedZone("UTC-7", int(-7*time.Hour/time.Second))
		created := time.Date(2025, 1, 1, 12, 0, 0, 0, location)
		initialExpiry := created.Add(30 * time.Minute)
		updated := created.Add(time.Hour)
		updatedExpiry := updated.Add(45 * time.Minute)
		GetTime = func() time.Time { return created }
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.GenericOAuthModule,
			AuthId:     "timezone-auth-id",
			UserId:     30,
			UserUID:    "30",
			OAuthToken: &oauth2.Token{
				AccessToken:  "initial-access-token",
				RefreshToken: "initial-refresh-token",
				Expiry:       initialExpiry,
			},
		}))

		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId:     30,
			AuthModule: login.GenericOAuthModule,
		})
		require.NoError(t, err)
		require.Equal(t, created.UTC(), info.Created)
		require.Equal(t, initialExpiry.UTC(), info.OAuthExpiry)

		GetTime = func() time.Time { return updated }
		require.NoError(t, store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
			AuthModule: login.GenericOAuthModule,
			AuthId:     "timezone-auth-id",
			UserId:     30,
			OAuthToken: &oauth2.Token{
				AccessToken:  "updated-access-token",
				RefreshToken: "updated-refresh-token",
				Expiry:       updatedExpiry,
			},
		}))

		info, err = store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId:     30,
			AuthModule: login.GenericOAuthModule,
		})
		require.NoError(t, err)
		require.Equal(t, updated.UTC(), info.Created)
		require.Equal(t, updatedExpiry.UTC(), info.OAuthExpiry)
	})

	t.Run("should populate missing user UID during store construction", func(t *testing.T) {
		ctx := context.Background()
		now := time.Now()
		usr := &user.User{
			UID:     "migration-user-uid",
			Login:   "migration-user",
			Email:   "migration-user@example.com",
			Created: now,
			Updated: now,
		}
		require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Insert(usr)
			return err
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.SAMLAuthModule,
			AuthId:     "migration-auth-id",
			UserId:     usr.ID,
			UserUID:    usr.UID,
		}))
		require.NoError(t, sql.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE user_auth SET user_uid = NULL WHERE user_id = ?", usr.ID)
			return err
		}))

		migrationStore, err := ProvideStore(ctx, legacysql.NewDatabaseProvider(sql), secretstest.NewFakeSecretsService())
		require.NoError(t, err)
		info, err := migrationStore.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId:     usr.ID,
			AuthModule: login.SAMLAuthModule,
		})
		require.NoError(t, err)
		require.Equal(t, usr.UID, info.UserUID)
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
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		calls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				return "test_schema." + name
			},
		}, nil
	}

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "test_schema"."user_auth" AS ua
SET user_uid = (
  SELECT uid
  FROM "test_schema"."user" AS u
  WHERE u.id = ua.user_id
)
WHERE ua.user_id IN (SELECT id FROM "test_schema"."user")
  AND ua.user_uid IS NULL`)).
		WillReturnResult(sqlmock.NewResult(0, 0))

	store, err := ProvideStore(ctx, provider, secretstest.NewFakeSecretsService())
	require.NoError(t, err)

	labels, err := store.GetUsersRecentlyUsedLabel(ctx, login.GetUserLabelsQuery{})
	require.NoError(t, err)
	require.Empty(t, labels)
	require.Equal(t, 1, calls)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT
  id,
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
FROM "test_schema"."user_auth"
WHERE 1 = 1
  AND user_id = ?
ORDER BY created DESC
LIMIT 1`)).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "user_uid", "auth_module", "auth_id", "created", "o_auth_access_token", "o_auth_refresh_token", "o_auth_id_token", "o_auth_token_type", "o_auth_expiry", "external_uid",
		}).AddRow(int64(1), int64(42), "user-uid", login.LDAPAuthModule, "auth-id", time.Now(), "", "", "", "", nil, "external-uid"))

	authInfo, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: 42})
	require.NoError(t, err)
	require.Equal(t, "auth-id", authInfo.AuthId)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, auth_module
FROM "test_schema"."user_auth"
WHERE user_id IN (?, ?)
ORDER BY created`)).
		WithArgs(int64(42), int64(84)).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "auth_module"}).
			AddRow(int64(42), login.LDAPAuthModule).
			AddRow(int64(84), login.GoogleAuthModule))

	labels, err = store.GetUsersRecentlyUsedLabel(ctx, login.GetUserLabelsQuery{UserIDs: []int64{42, 84}})
	require.NoError(t, err)
	require.Equal(t, login.LDAPAuthModule, labels[42])

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT auth_module
FROM "test_schema"."user_auth"
WHERE user_id = ?
ORDER BY created DESC`)).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"auth_module"}).
			AddRow(login.LDAPAuthModule).
			AddRow(login.LDAPAuthModule))

	modules, err := store.GetUserAuthModules(ctx, 42)
	require.NoError(t, err)
	require.Equal(t, []string{login.LDAPAuthModule}, modules)

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO "test_schema"."user_auth" (
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
)
VALUES (
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?,
  ?
)`)).
		WithArgs(int64(42), "user-uid", login.LDAPAuthModule, "auth-id", sqlmock.AnyArg(), "", "", "", "", nil, "").
		WillReturnResult(sqlmock.NewResult(1, 1))

	require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
		UserId:     42,
		UserUID:    "user-uid",
		AuthModule: login.LDAPAuthModule,
		AuthId:     "auth-id",
	}))

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "test_schema"."user_auth"
SET auth_id = ?,
    external_uid = ?,
    created = ?,
    o_auth_expiry = ?,
    o_auth_access_token = ?,
    o_auth_refresh_token = ?,
    o_auth_id_token = ?,
    o_auth_token_type = ?
WHERE user_id = ?
  AND auth_module = ?`)).
		WithArgs("new-auth-id", "new-external-uid", sqlmock.AnyArg(), nil, "", "", "", "", int64(42), login.LDAPAuthModule).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id
FROM "test_schema"."user_auth"
WHERE user_id = ?
  AND auth_module = ?
  AND auth_id = ?`)).
		WithArgs(int64(42), login.LDAPAuthModule, "new-auth-id").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(1)))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."user_auth"
WHERE user_id = ?
  AND auth_module = ?
  AND auth_id = ?
  AND id != ?`)).
		WithArgs(int64(42), login.LDAPAuthModule, "new-auth-id", int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:      42,
		AuthModule:  login.LDAPAuthModule,
		AuthId:      "new-auth-id",
		ExternalUID: "new-external-uid",
	}))

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM "test_schema"."user_auth"
WHERE user_id = ?`)).
		WithArgs(int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	require.NoError(t, store.DeleteUserAuthInfo(ctx, 42))

	require.Equal(t, 7, calls)
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
	now := time.Date(2025, 7, 22, 15, 0, 0, 0, time.UTC)

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			getAuthInfoTemplate: {
				{
					Name: "by_user",
					Data: getAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
					},
				},
				{
					Name: "by_auth",
					Data: getAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						AuthModule:    login.LDAPAuthModule,
						AuthID:        "auth-id",
					},
				},
			},
			getUsersRecentlyUsedLabelTemplate: {
				{
					Name: "user_ids",
					Data: getUsersRecentlyUsedLabelQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserIDs:       []int64{42, 84},
					},
				},
			},
			getUserAuthModulesTemplate: {
				{
					Name: "by_user",
					Data: getUserAuthModulesQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
					},
				},
			},
			insertAuthInfoTemplate: {
				{
					Name: "insert",
					Data: insertAuthInfoQuery{
						SQLTemplate:       queryTemplate(),
						UserAuthTable:     userAuthTable,
						UserID:            42,
						UserUID:           "user-uid",
						AuthModule:        login.LDAPAuthModule,
						AuthID:            "auth-id",
						Created:           legacysql.NewDBTime(now),
						OAuthAccessToken:  "access-token",
						OAuthRefreshToken: "refresh-token",
						OAuthIDToken:      "id-token",
						OAuthTokenType:    "bearer",
						OAuthExpiry:       legacysql.NewDBTime(now),
						ExternalUID:       "external-uid",
					},
				},
			},
			updateAuthInfoTemplate: {
				{
					Name: "update",
					Data: updateAuthInfoQuery{
						SQLTemplate:       queryTemplate(),
						UserAuthTable:     userAuthTable,
						UserID:            42,
						AuthModule:        login.LDAPAuthModule,
						AuthID:            "auth-id",
						ExternalUID:       "external-uid",
						Created:           legacysql.NewDBTime(now),
						OAuthAccessToken:  "access-token",
						OAuthRefreshToken: "refresh-token",
						OAuthIDToken:      "id-token",
						OAuthTokenType:    "bearer",
						OAuthExpiry:       legacysql.NewDBTime(now),
					},
				},
				{
					Name: "oauth_only",
					Data: updateAuthInfoQuery{
						SQLTemplate:       queryTemplate(),
						UserAuthTable:     userAuthTable,
						UserID:            42,
						AuthModule:        login.LDAPAuthModule,
						Created:           legacysql.NewDBTime(now),
						OAuthAccessToken:  "access-token",
						OAuthRefreshToken: "refresh-token",
						OAuthIDToken:      "id-token",
						OAuthTokenType:    "bearer",
						OAuthExpiry:       legacysql.NewDBTime(now),
					},
				},
			},
			findDuplicateAuthInfoTemplate: {
				{
					Name: "find",
					Data: findDuplicateAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
						AuthModule:    login.LDAPAuthModule,
						AuthID:        "auth-id",
					},
				},
			},
			deleteDuplicateAuthInfoTemplate: {
				{
					Name: "delete",
					Data: deleteDuplicateAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
						AuthModule:    login.LDAPAuthModule,
						AuthID:        "auth-id",
						ID:            1,
					},
				},
			},
			deleteUserAuthInfoTemplate: {
				{
					Name: "delete",
					Data: deleteUserAuthInfoQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserID:        42,
					},
				},
			},
			authInfoUserUIDMigrationTemplate: {
				{
					Name: "populate_user_uid",
					Data: authInfoUserUIDMigrationQuery{
						SQLTemplate:   queryTemplate(),
						UserAuthTable: userAuthTable,
						UserTable:     userTable,
					},
				},
			},
		},
	})
}
