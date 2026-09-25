package legacy

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

type starsTestDB struct {
	dbtest.FakeDB
	sess *session.SessionDB
}

func (db *starsTestDB) GetSqlxSession() *session.SessionDB { return db.sess }
func (db *starsTestDB) GetDBType() core.DbType             { return core.SQLITE }

func TestGetDashboardStarsWithNullUpdated(t *testing.T) {
	for _, tc := range []struct {
		name           string
		rows           *sqlmock.Rows
		want           int64
		wantDashboards []string
	}{
		{
			name: "mixed timestamps",
			rows: sqlmock.NewRows([]string{"org_id", "user_uid", "dashboard_uid", "updated"}).
				AddRow(1, "alice", "old", nil).
				AddRow(1, "alice", "recent", time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)).
				AddRow(1, "alice", "missing", nil),
			want:           time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
			wantDashboards: []string{"old", "recent", "missing"},
		},
		{
			name: "only null timestamps",
			rows: sqlmock.NewRows([]string{"org_id", "user_uid", "dashboard_uid", "updated"}).
				AddRow(1, "alice", "old", nil),
			wantDashboards: []string{"old"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			t.Cleanup(func() { _ = db.Close() })

			mock.ExpectQuery("SELECT s.org_id").WithArgs(int64(1), "alice").WillReturnRows(tc.rows)
			helper := &legacysql.LegacyDatabaseHelper{
				DB:    &starsTestDB{sess: session.GetSession(sqlx.NewDb(db, "sqlmock"))},
				Table: func(name string) string { return name },
			}
			store := NewLegacySQL(func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
				return helper, nil
			})

			stars, rv, err := store.getDashboardStars(context.Background(), 1, "alice")
			require.NoError(t, err)
			require.Len(t, stars, 1)
			require.Equal(t, tc.wantDashboards, stars[0].Dashboards)
			require.Equal(t, tc.want, stars[0].First)
			require.Equal(t, tc.want, stars[0].Last)
			require.Equal(t, tc.want, rv)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
