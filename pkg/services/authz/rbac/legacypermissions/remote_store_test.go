package legacypermissions

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

func TestIntegrationPermissionStoreMembershipParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	shared := ac.Permission{Action: "users:read", Scope: "users:*"}
	empty := ac.Permission{Action: "users:create", Scope: ""}
	global := ac.Permission{Action: "users:read", Scope: "global"}
	other := ac.Permission{Action: "users:read", Scope: "other"}
	seedPermissionStoreGrants(t, database, "custom:shared", 1, 7, shared, empty)
	seedPermissionStoreGrants(t, database, "custom:duplicate", 1, 7, shared)
	seedPermissionStoreGrants(t, database, "custom:global", 0, 7, global)
	seedPermissionStoreGrants(t, database, "custom:other", 2, 7, other)
	require.NoError(t, database.WithDbSession(t.Context(), func(sess *db.Session) error {
		for _, assignment := range []struct {
			name string
			org  int64
			team int64
		}{
			{"custom:shared", 1, 11}, {"custom:shared", 1, 12},
			{"custom:duplicate", 1, 11}, {"custom:duplicate", 1, 12},
			{"custom:global", 0, 11}, {"custom:other", 2, 11},
		} {
			var role ac.Role
			found, err := sess.Where("uid = ?", assignment.name).Get(&role)
			if err != nil {
				return err
			}
			require.True(t, found)
			if _, err = sess.Insert(&ac.TeamRole{RoleID: role.ID, TeamID: assignment.team, OrgID: assignment.org, Created: time.Now()}); err != nil {
				return err
			}
			// Two memberships reaching one role must not multiply its permission rows.
			for _, builtin := range []string{"Viewer", "Editor"} {
				if assignment.team == 12 {
					continue
				}
				if _, err = sess.Insert(&ac.BuiltinRole{RoleID: role.ID, Role: builtin, OrgID: assignment.org, Created: time.Now(), Updated: time.Now()}); err != nil {
					return err
				}
			}
		}
		return nil
	}))

	stores := map[string]permissionReader{
		"embedded": permissionStore{sql: database},
		"remote":   remotePermissionStore{database: legacysql.NewDatabaseProvider(database)},
	}
	for _, tc := range []struct {
		name  string
		query ac.GetUserPermissionsQuery
		want  []ac.Permission
	}{
		{"user", ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7}, []ac.Permission{shared, empty, shared, global}},
		{"teams", ac.GetUserPermissionsQuery{OrgID: 1, TeamIDs: []int64{11}}, []ac.Permission{shared, empty, shared}},
		{"roles", ac.GetUserPermissionsQuery{OrgID: 1, Roles: []string{"Viewer"}}, []ac.Permission{shared, empty, shared, global}},
		{"combined", ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7, TeamIDs: []int64{11, 12}, Roles: []string{"Viewer", "Editor"}}, []ac.Permission{shared, empty, shared, global}},
		{"global", ac.GetUserPermissionsQuery{OrgID: 0, UserID: 7, Roles: []string{"Viewer"}}, []ac.Permission{global}},
		{"no membership", ac.GetUserPermissionsQuery{OrgID: -1, UserID: 7, TeamIDs: []int64{11}}, []ac.Permission{global}},
		{"negative user with role", ac.GetUserPermissionsQuery{OrgID: 1, UserID: -1, Roles: []string{"Viewer"}}, []ac.Permission{shared, empty, shared, global}},
		{"prefixes", ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7, RolePrefixes: []string{"custom:global", "missing:"}}, []ac.Permission{global}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for name, store := range stores {
				t.Run(name, func(t *testing.T) {
					got, err := store.permissions(t.Context(), tc.query)
					require.NoError(t, err)
					require.ElementsMatch(t, tc.want, got)
				})
			}
		})
	}
	for name, store := range stores {
		t.Run(name+" grouped teams", func(t *testing.T) {
			got, err := store.teams(t.Context(), ac.GetUserPermissionsQuery{OrgID: 1, TeamIDs: []int64{11, 12, 99}})
			require.NoError(t, err)
			require.Len(t, got, 2)
			for _, teamID := range []int64{11, 12} {
				require.ElementsMatch(t, []ac.Permission{shared, empty, shared}, got[teamID])
			}
		})
	}
}

func TestIntegrationPermissionStoreTeamFilters(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	direct := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:managed", Kind: "dashboards"}
	actionSet := ac.Permission{Action: "dashboards:view", Scope: "dashboards:uid:managed"}
	custom := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:custom"}
	seedPermissionStoreGrants(t, database, "managed:team", 1, 7, direct, actionSet)
	seedPermissionStoreGrants(t, database, "custom:team", 1, 7, custom)
	require.NoError(t, database.WithDbSession(t.Context(), func(sess *db.Session) error {
		for _, name := range []string{"managed:team", "custom:team"} {
			var role ac.Role
			found, err := sess.Where("uid = ?", name).Get(&role)
			if err != nil {
				return err
			}
			require.True(t, found)
			if _, err = sess.Insert(&ac.TeamRole{RoleID: role.ID, TeamID: 11, OrgID: 1, Created: time.Now()}); err != nil {
				return err
			}
		}
		return nil
	}))
	direct.Kind = ""
	for _, tc := range []struct {
		name     string
		prefixes []string
		exclude  bool
		want     []ac.Permission
	}{
		{"all", nil, false, []ac.Permission{direct, actionSet, custom}},
		{"managed", []string{"managed:"}, false, []ac.Permission{direct, actionSet}},
		{"exclude", nil, true, []ac.Permission{actionSet, custom}},
		{"combined", []string{"managed:"}, true, []ac.Permission{actionSet}},
		{"no match", []string{"missing:"}, true, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for name, store := range map[string]permissionReader{
				"embedded": permissionStore{sql: database},
				"remote":   remotePermissionStore{database: legacysql.NewDatabaseProvider(database)},
			} {
				t.Run(name, func(t *testing.T) {
					got, err := store.teams(t.Context(), ac.GetUserPermissionsQuery{OrgID: 1, TeamIDs: []int64{11}, RolePrefixes: tc.prefixes, ExcludeRedundantManagedPermissions: tc.exclude})
					require.NoError(t, err)
					require.ElementsMatch(t, tc.want, got[11])
					if len(tc.want) == 0 {
						require.Empty(t, got)
					} else {
						require.Len(t, got, 1)
					}
				})
			}
		})
	}
}

func TestRemotePermissionStoreEmptyAndProviderFailure(t *testing.T) {
	boom := errors.New("tenant lookup failed")
	calls := 0
	store := remotePermissionStore{database: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		calls++
		return nil, boom
	}}
	got, err := store.permissions(t.Context(), ac.GetUserPermissionsQuery{})
	require.NoError(t, err)
	require.Empty(t, got)
	teams, err := store.teams(t.Context(), ac.GetUserPermissionsQuery{})
	require.NoError(t, err)
	require.Nil(t, teams)
	require.Zero(t, calls)
	got, err = store.permissions(t.Context(), ac.GetUserPermissionsQuery{UserID: 7})
	require.ErrorIs(t, err, boom)
	require.Nil(t, got)
	teams, err = store.teams(t.Context(), ac.GetUserPermissionsQuery{TeamIDs: []int64{11}})
	require.ErrorIs(t, err, boom)
	require.Nil(t, teams)
	require.Equal(t, 2, calls)
}

type remoteTestDB struct {
	db.DB
	sql *session.SessionDB
}

func (d remoteTestDB) GetDBType() core.DbType             { return core.MYSQL }
func (d remoteTestDB) GetSqlxSession() *session.SessionDB { return d.sql }

func TestRemotePermissionStoreDiscardsFailedReads(t *testing.T) {
	for _, teams := range []bool{false, true} {
		for _, failure := range []string{"query", "scan", "rows", "canceled", "deadline"} {
			name := "permissions/" + failure
			if teams {
				name = "teams/" + failure
			}
			t.Run(name, func(t *testing.T) {
				sqlDB, mock, err := sqlmock.New()
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, mock.ExpectationsWereMet()); _ = sqlDB.Close() })
				database := remoteTestDB{sql: session.GetSession(sqlx.NewDb(sqlDB, "mysql"))}
				store := remotePermissionStore{database: legacysql.NewDatabaseProvider(database)}
				ctx := t.Context()
				boom := errors.New("database failure")
				var wantErr error
				if failure == "canceled" || failure == "deadline" {
					var cancel context.CancelFunc
					if failure == "canceled" {
						ctx, cancel = context.WithCancel(ctx)
						wantErr = context.Canceled
					} else {
						ctx, cancel = context.WithDeadline(ctx, time.Now().Add(-time.Second))
						wantErr = context.DeadlineExceeded
					}
					cancel()
				} else {
					expect := mock.ExpectQuery("SELECT")
					if failure == "query" {
						expect.WillReturnError(boom)
						wantErr = boom
					} else {
						columns := []string{"action", "scope"}
						if teams {
							columns = append(columns, "team_id")
						}
						rows := sqlmock.NewRows(columns)
						if teams {
							rows.AddRow("users:read", "users:*", 11)
						} else {
							rows.AddRow("users:read", "users:*")
						}
						if failure == "scan" {
							if teams {
								rows.AddRow(nil, "", 11)
							} else {
								rows.AddRow(nil, "")
							}
						} else {
							if teams {
								rows.AddRow("users:create", "", 11)
							} else {
								rows.AddRow("users:create", "")
							}
							rows.RowError(1, boom)
							wantErr = boom
						}
						expect.WillReturnRows(rows).RowsWillBeClosed()
					}
				}
				query := ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7, TeamIDs: []int64{11}}
				if teams {
					got, callErr := store.teams(ctx, query)
					err = callErr
					require.Nil(t, got)
				} else {
					got, callErr := store.permissions(ctx, query)
					err = callErr
					require.Nil(t, got)
				}
				require.Error(t, err)
				if wantErr != nil {
					require.ErrorIs(t, err, wantErr)
				}
			})
		}
	}
}
