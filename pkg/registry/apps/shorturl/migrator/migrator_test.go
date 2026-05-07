package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"text/template"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestShortURLQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getShortURLQuery := func(q *ShortURLQuery) sqltemplate.SQLTemplate {
		v := newShortURLQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: shortURLSQLTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryShortURLs: {
				{
					Name: "list",
					Data: getShortURLQuery(&ShortURLQuery{
						OrgID: 1,
					}),
				},
				{
					Name: "last-id",
					Data: getShortURLQuery(&ShortURLQuery{
						OrgID:  1,
						LastID: 5,
					}),
				},
				{
					Name: "limit",
					Data: getShortURLQuery(&ShortURLQuery{
						OrgID: 1,
						Limit: 10,
					}),
				},
				{
					Name: "all",
					Data: getShortURLQuery(&ShortURLQuery{
						OrgID:  1,
						LastID: 5,
						Limit:  10,
					}),
				},
			},
		},
	})
}

func TestMigrateShortURLs_ProgressTimingLogs(t *testing.T) {
	tests := []struct {
		name                 string
		totalRows            int
		expectedLastIDs      []int64
		expectedProgressRows int
	}{
		{
			name:                 "single batch",
			totalRows:            2,
			expectedLastIDs:      []int64{0},
			expectedProgressRows: 2,
		},
		{
			name:                 "multiple batches",
			totalRows:            1001,
			expectedLastIDs:      []int64{0, 1000},
			expectedProgressRows: 1001,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = db.Close()
			})

			records := makeShortURLRows(tc.totalRows)
			for _, lastID := range tc.expectedLastIDs {
				query := fmt.Sprintf("SELECT %d", lastID)
				mock.ExpectQuery(query).WillReturnRows(newShortURLSQLRows(recordsAfter(records, lastID, 1000)))
			}

			var observedLastIDs []int64
			m := &shortURLMigrator{
				listShortURLsFn: func(_ context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
					require.Equal(t, int64(1), orgID)
					require.Equal(t, int64(1000), limit)
					observedLastIDs = append(observedLastIDs, lastID)
					return db.Query(fmt.Sprintf("SELECT %d", lastID))
				},
			}

			stream := &capturingBulkProcessClient{}
			var progress []progressEvent
			err = m.MigrateShortURLs(context.Background(), 1, migrations.MigrateOptions{
				Namespace: "default",
				Progress: func(count int, msg string) {
					progress = append(progress, progressEvent{count: count, msg: msg})
				},
			}, stream)
			require.NoError(t, err)
			require.Equal(t, tc.expectedLastIDs, observedLastIDs)
			require.Len(t, stream.requests, tc.totalRows)

			require.Len(t, progress, 5)
			require.Equal(t, -1, progress[0].count)
			require.Equal(t, tc.expectedProgressRows, progress[1].count)
			require.Equal(t, tc.expectedProgressRows, progress[2].count)
			require.Equal(t, tc.expectedProgressRows, progress[3].count)
			require.Equal(t, -2, progress[4].count)

			require.Equal(t, "migrating short URLs...", progress[0].msg)
			require.Contains(t, progress[1].msg, "finished reading legacy short URLs from legacy short_url table in ")
			require.Contains(t, progress[2].msg, "finished converting legacy short URLs to unified storage format in ")
			require.Contains(t, progress[3].msg, "finished writing short URLs to unified storage in ")
			require.Equal(t, fmt.Sprintf("finished short URLs... (%d)", tc.totalRows), progress[4].msg)

			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

type progressEvent struct {
	count int
	msg   string
}

type capturingBulkProcessClient struct {
	grpc.ClientStream
	requests []*resourcepb.BulkRequest
}

func (c *capturingBulkProcessClient) Send(req *resourcepb.BulkRequest) error {
	c.requests = append(c.requests, req)
	return nil
}

func (c *capturingBulkProcessClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

type testShortURLRow struct {
	id int64
	shortURLRow
}

func makeShortURLRows(total int) []testShortURLRow {
	rows := make([]testShortURLRow, 0, total)
	for i := 1; i <= total; i++ {
		rows = append(rows, testShortURLRow{
			id: int64(i),
			shortURLRow: shortURLRow{
				uid:        fmt.Sprintf("uid-%04d", i),
				path:       fmt.Sprintf("/d/%04d", i),
				createdBy:  42,
				createdAt:  1710000000 + int64(i),
				lastSeenAt: 1710001000 + int64(i),
			},
		})
	}
	return rows
}

func recordsAfter(rows []testShortURLRow, lastID int64, limit int) []testShortURLRow {
	result := make([]testShortURLRow, 0, len(rows))
	for _, row := range rows {
		if row.id > lastID {
			result = append(result, row)
		}
		if len(result) == limit {
			break
		}
	}
	return result
}

func newShortURLSQLRows(rows []testShortURLRow) *sqlmock.Rows {
	sqlRows := sqlmock.NewRows([]string{"id", "org_id", "uid", "path", "created_by", "created_at", "last_seen_at"})
	for _, row := range rows {
		sqlRows.AddRow(row.id, int64(1), row.uid, row.path, row.createdBy, row.createdAt, row.lastSeenAt)
	}
	return sqlRows
}
