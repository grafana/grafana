package migrator

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"text/template"
	"time"

	claims "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed query_snapshots.sql
var snapshotSQLTemplatesFS embed.FS

var sqlQuerySnapshots = template.Must(
	template.New("sql").ParseFS(snapshotSQLTemplatesFS, "query_snapshots.sql"),
).Lookup("query_snapshots.sql")

type SnapshotMigrator interface {
	MigrateSnapshots(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// snapshotMigrator handles migrating dashboard snapshots from legacy SQL storage.
type snapshotMigrator struct {
	sql     legacysql.LegacyDatabaseProvider
	secrets secrets.Service
}

// ProvideSnapshotMigrator creates a snapshotMigrator for use in wire DI.
func ProvideSnapshotMigrator(sql legacysql.LegacyDatabaseProvider, secretsSvc secrets.Service) SnapshotMigrator {
	return &snapshotMigrator{sql: sql, secrets: secretsSvc}
}

// MigrateSnapshots handles the snapshot migration logic.
func (m *snapshotMigrator) MigrateSnapshots(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating snapshots...")

	var lastID int64 = 0
	// Batch size is smaller than ShortURL (1000) because dashboard payloads can be several MB.
	limit := int64(100)
	count := 0
	readDuration := time.Duration(0)
	convertDuration := time.Duration(0)
	writeDuration := time.Duration(0)

	for {
		readStart := time.Now()
		rows, err := m.listSnapshots(ctx, orgId, lastID, limit)
		if err != nil {
			return err
		}

		rawRows := make([]snapshotRow, 0, limit)
		for rows.Next() {
			var row snapshotRow
			err = rows.Scan(
				&row.id,
				&row.orgID,
				&row.name,
				&row.key,
				&row.deleteKey,
				&row.userID,
				&row.external,
				&row.externalURL,
				&row.dashboardEncrypted,
				&row.expires,
				&row.created,
				&row.updated,
			)
			if err != nil {
				_ = rows.Close()
				return err
			}
			lastID = row.id
			rawRows = append(rawRows, row)
		}

		if err = rows.Err(); err != nil {
			_ = rows.Close()
			return err
		}
		_ = rows.Close()
		readDuration += time.Since(readStart)

		if len(rawRows) == 0 {
			break
		}

		convertStart := time.Now()
		chunk := make([]*resourcepb.BulkRequest, 0, len(rawRows))
		for _, row := range rawRows {
			snap := &dashV0.Snapshot{
				TypeMeta: metav1.TypeMeta{
					APIVersion: dashV0.APIVERSION,
					Kind:       "Snapshot",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:              row.key,
					Namespace:         opts.Namespace,
					CreationTimestamp: metav1.NewTime(row.created),
				},
				Spec: dashV0.SnapshotSpec{
					Title: &row.name,
				},
			}

			if row.userID > 0 {
				snap.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(row.userID, 10)))
			}

			// Store the deleteKey in spec; storageWrapper strips it from GET/LIST responses.
			if row.deleteKey != "" {
				snap.Spec.DeleteKey = &row.deleteKey
			}

			if row.external {
				snap.Spec.External = &row.external
				if row.externalURL.Valid && row.externalURL.String != "" {
					snap.Spec.ExternalUrl = &row.externalURL.String
				}
			} else if len(row.dashboardEncrypted) > 0 {
				plain, err := m.secrets.Decrypt(ctx, row.dashboardEncrypted)
				if err != nil {
					opts.Progress(count, fmt.Sprintf("WARN: failed to decrypt snapshot %q, skipping dashboard data: %v", row.key, err))
				} else {
					j, err := simplejson.NewJson(plain)
					if err != nil {
						opts.Progress(count, fmt.Sprintf("WARN: failed to parse dashboard JSON for snapshot %q, skipping dashboard data: %v", row.key, err))
					} else {
						snap.Spec.Dashboard = j.MustMap()
					}
				}
			}

			// Mirror the logic in conversions.go: treat dates past year 2070 as "never expires".
			if row.expires.Valid && !row.expires.Time.IsZero() &&
				row.expires.Time.Before(time.Date(2070, time.January, 1, 0, 0, 0, 0, time.UTC)) {
				expiresMs := row.expires.Time.UnixMilli()
				snap.Spec.Expires = &expiresMs
			}

			if !row.updated.IsZero() && row.updated != row.created {
				meta, _ := utils.MetaAccessor(snap)
				meta.SetUpdatedTimestamp(&row.updated)
			}

			body, err := json.Marshal(snap)
			if err != nil {
				return err
			}

			chunk = append(chunk, &resourcepb.BulkRequest{
				Key: &resourcepb.ResourceKey{
					Namespace: opts.Namespace,
					Group:     dashV0.GROUP,
					Resource:  dashV0.SNAPSHOT_RESOURCE,
					Name:      row.key,
				},
				Value:  body,
				Action: resourcepb.BulkRequest_ADDED,
			})
		}
		convertDuration += time.Since(convertStart)

		writeStart := time.Now()
		for _, req := range chunk {
			count++
			if err := stream.Send(req); err != nil {
				if errors.Is(err, io.EOF) {
					opts.Progress(count, fmt.Sprintf("stream EOF/cancelled. index=%d", count))
				}
				return err
			}
		}
		writeDuration += time.Since(writeStart)

		if int64(len(rawRows)) < limit {
			break
		}
	}

	opts.Progress(count, fmt.Sprintf("finished reading snapshots from legacy table in %s (%d)", readDuration, count))
	opts.Progress(count, fmt.Sprintf("finished converting snapshots to unified storage format in %s (%d)", convertDuration, count))
	opts.Progress(count, fmt.Sprintf("finished writing snapshots to unified storage in %s (%d)", writeDuration, count))
	opts.Progress(-2, fmt.Sprintf("finished snapshots... (%d)", count))
	return nil
}

type snapshotRow struct {
	id                 int64
	orgID              int64
	name               string
	key                string
	deleteKey          string
	userID             int64
	external           bool
	externalURL        sql.NullString
	dashboardEncrypted []byte
	expires            sql.NullTime
	created            time.Time
	updated            time.Time
}

func (m *snapshotMigrator) listSnapshots(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newSnapshotQueryReq(helper, &SnapshotQuery{
		OrgID:  orgID,
		LastID: lastID,
		Limit:  limit,
	})

	rawQuery, err := sqltemplate.Execute(sqlQuerySnapshots, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQuerySnapshots.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

type SnapshotQuery struct {
	OrgID  int64
	LastID int64
	Limit  int64
}

type sqlSnapshotQuery struct {
	sqltemplate.SQLTemplate
	Query         *SnapshotQuery
	SnapshotTable string
}

func (r sqlSnapshotQuery) Validate() error {
	return nil
}

func newSnapshotQueryReq(sql *legacysql.LegacyDatabaseHelper, query *SnapshotQuery) sqlSnapshotQuery {
	return sqlSnapshotQuery{
		SQLTemplate:   sqltemplate.New(sql.DialectForDriver()),
		Query:         query,
		SnapshotTable: sql.Table("dashboard_snapshot"),
	}
}
