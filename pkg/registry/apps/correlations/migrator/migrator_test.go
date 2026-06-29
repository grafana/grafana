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

func TestCorrelationQueries(t *testing.T) {
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getCorrelationQuery := func(q *CorrelationQuery) sqltemplate.SQLTemplate {
		v := newCorrelationQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: correlationSQLTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryCorrelations: {
				{
					Name: "list",
					Data: getCorrelationQuery(&CorrelationQuery{
						OrgID: 1,
					}),
				},
				{
					Name: "last-uid",
					Data: getCorrelationQuery(&CorrelationQuery{
						OrgID:   1,
						LastUID: "abc123",
					}),
				},
				{
					Name: "limit",
					Data: getCorrelationQuery(&CorrelationQuery{
						OrgID: 1,
						Limit: 10,
					}),
				},
				{
					Name: "all",
					Data: getCorrelationQuery(&CorrelationQuery{
						OrgID:   1,
						LastUID: "abc123",
						Limit:   10,
					}),
				},
			},
		},
	})
}

func TestMigrateCorrelations_ProgressTimingLogs(t *testing.T) {
	tests := []struct {
		name                 string
		totalRows            int
		expectedLastUIDs     []string
		expectedProgressRows int
	}{
		{
			name:                 "single batch",
			totalRows:            2,
			expectedLastUIDs:     []string{""},
			expectedProgressRows: 2,
		},
		{
			name:                 "multiple batches",
			totalRows:            1001,
			expectedLastUIDs:     []string{"", fmt.Sprintf("uid-%04d", 1000)},
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

			records := makeCorrelationRows(tc.totalRows)
			for _, lastUID := range tc.expectedLastUIDs {
				query := fmt.Sprintf("SELECT '%s'", lastUID)
				mock.ExpectQuery(query).WillReturnRows(newCorrelationSQLRows(correlationsAfter(records, lastUID, 1000)))
			}

			var observedLastUIDs []string
			m := &correlationsMigrator{
				listCorrelationsFn: func(_ context.Context, orgID int64, lastUID string, limit int64) (*sql.Rows, error) {
					require.Equal(t, int64(1), orgID)
					require.Equal(t, int64(1000), limit)
					observedLastUIDs = append(observedLastUIDs, lastUID)
					return db.Query(fmt.Sprintf("SELECT '%s'", lastUID))
				},
			}

			stream := &capturingBulkProcessClient{}
			var progress []progressEvent
			err = m.MigrateCorrelations(context.Background(), 1, migrations.MigrateOptions{
				Namespace: "org-1",
				Progress: func(count int, msg string) {
					progress = append(progress, progressEvent{count: count, msg: msg})
				},
			}, stream)
			require.NoError(t, err)
			require.Equal(t, tc.expectedLastUIDs, observedLastUIDs)
			require.Len(t, stream.requests, tc.totalRows)

			require.Len(t, progress, 5)
			require.Equal(t, -1, progress[0].count)
			require.Equal(t, tc.expectedProgressRows, progress[1].count)
			require.Equal(t, tc.expectedProgressRows, progress[2].count)
			require.Equal(t, tc.expectedProgressRows, progress[3].count)
			require.Equal(t, -2, progress[4].count)

			require.Equal(t, "migrating correlations...", progress[0].msg)
			require.Contains(t, progress[1].msg, "finished reading legacy correlations from legacy correlation table in ")
			require.Contains(t, progress[2].msg, "finished converting legacy correlations to unified storage format in ")
			require.Contains(t, progress[3].msg, "finished writing correlations to unified storage in ")
			require.Equal(t, fmt.Sprintf("finished correlations... (%d)", tc.totalRows), progress[4].msg)

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

type testCorrelationRow struct {
	uid string
	correlationRow
}

func makeCorrelationRows(total int) []testCorrelationRow {
	rows := make([]testCorrelationRow, 0, total)
	for i := 1; i <= total; i++ {
		uid := fmt.Sprintf("uid-%04d", i)
		targetUID := fmt.Sprintf("target-%04d", i)
		rows = append(rows, testCorrelationRow{
			uid: uid,
			correlationRow: correlationRow{
				uid:             uid,
				orgID:           1,
				sourceUID:       fmt.Sprintf("source-%04d", i),
				targetUID:       &targetUID,
				label:           fmt.Sprintf("Label %d", i),
				description:     fmt.Sprintf("Description %d", i),
				config:          `{"field":"traceID","target":{"expr":"${__value.raw}"}}`,
				provisioned:     false,
				correlationType: "query",
			},
		})
	}
	return rows
}

func correlationsAfter(rows []testCorrelationRow, lastUID string, limit int) []testCorrelationRow {
	result := make([]testCorrelationRow, 0, len(rows))
	for _, row := range rows {
		if row.uid > lastUID {
			result = append(result, row)
		}
		if len(result) == limit {
			break
		}
	}
	return result
}

func newCorrelationSQLRows(rows []testCorrelationRow) *sqlmock.Rows {
	sqlRows := sqlmock.NewRows([]string{"uid", "org_id", "source_uid", "target_uid", "label", "description", "config", "provisioned", "type"})
	for _, row := range rows {
		sqlRows.AddRow(
			row.correlationRow.uid,
			row.correlationRow.orgID,
			row.correlationRow.sourceUID,
			row.correlationRow.targetUID,
			row.correlationRow.label,
			row.correlationRow.description,
			row.correlationRow.config,
			row.correlationRow.provisioned,
			row.correlationRow.correlationType,
		)
	}
	return sqlRows
}
