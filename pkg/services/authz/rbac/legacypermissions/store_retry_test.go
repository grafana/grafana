package legacypermissions

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/sqlite"
)

func TestPermissionStoreSQLiteRetryDiscardsPartialResults(t *testing.T) {
	if !db.IsTestDbSQLite() {
		t.Skip("SQLite retry behavior")
	}
	for _, teams := range []bool{false, true} {
		name := "permissions"
		if teams {
			name = "teams"
		}
		t.Run(name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Raw.Section("database").Key("query_retries").SetValue("2")
			database := db.NewTestStore(t, db.WithCfg(cfg), db.WithoutMigrator(), db.WithoutDefaultOrgAndUser())
			sqlDB, mock, err := sqlmock.New()
			require.NoError(t, err)
			engineDB := database.GetEngine().DB()
			original := engineDB.DB
			engineDB.DB = sqlDB
			t.Cleanup(func() {
				engineDB.DB = original
				require.NoError(t, mock.ExpectationsWereMet())
				_ = sqlDB.Close()
			})
			columns := []string{"action", "scope"}
			if teams {
				columns = append(columns, "team_id")
			}
			partial := sqlmock.NewRows(columns)
			complete := sqlmock.NewRows(columns)
			if teams {
				partial.AddRow("users:read", "stale", 11).AddRow("users:read", "interrupted", 11)
				complete.AddRow("users:read", "fresh", 11)
			} else {
				partial.AddRow("users:read", "stale").AddRow("users:read", "interrupted")
				complete.AddRow("users:read", "fresh")
			}
			mock.ExpectQuery("SELECT").WillReturnRows(partial.RowError(1, sqlite.ErrTestBusy)).RowsWillBeClosed()
			mock.ExpectQuery("SELECT").WillReturnRows(complete).RowsWillBeClosed()

			recorder := recordPermissionSpans(t)
			store := permissionStore{database: legacysql.NewDatabaseProvider(database)}
			query := ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7, TeamIDs: []int64{11}}
			var got []ac.Permission
			if teams {
				result, err := store.teams(t.Context(), query)
				require.NoError(t, err)
				require.Len(t, result, 1)
				got = result[11]
			} else {
				got, err = store.permissions(t.Context(), query)
				require.NoError(t, err)
			}
			require.Equal(t, []ac.Permission{{Action: "users:read", Scope: "fresh"}}, got)
			parent := permissionSpan(t, recorder, "sql."+name)
			require.Equal(t, attribute.IntValue(2), spanAttributes(parent)["query.count"])
			require.NotEqual(t, codes.Error, parent.Status().Code)
			require.Len(t, recorder.Ended(), 3, "one parent and one scan span per attempt")
		})
	}
}
