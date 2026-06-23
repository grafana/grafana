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
	"github.com/grafana/grafana/pkg/infra/log"
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

var logger = log.New("storage.unified.snapshot.migrator")

type SnapshotMigrator interface {
	MigrateSnapshots(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// snapshotMigrator handles migrating dashboard snapshots from legacy SQL storage.
type snapshotMigrator struct {
	sql             legacysql.LegacyDatabaseProvider
	secretsService  secrets.Service //nolint:staticcheck // SA1019: legacy envelope encryption — matches dashboardsnapshots.Service
	listSnapshotsFn func(context.Context, int64, int64, int64) (*sql.Rows, error)
}

// ProvideSnapshotMigrator creates a snapshotMigrator for use in wire DI.
// It takes the legacy secrets.Service so the encrypted dashboard blob written by
// dashboardsnapshots.Service.CreateDashboardSnapshot can be decrypted before
// being serialized into the K8s Snapshot.Spec.Dashboard field.
func ProvideSnapshotMigrator(
	sql legacysql.LegacyDatabaseProvider,
	secretsService secrets.Service, //nolint:staticcheck // SA1019
) SnapshotMigrator {
	return &snapshotMigrator{sql: sql, secretsService: secretsService}
}

// MigrateSnapshots reads dashboard snapshots from legacy SQL storage and streams
// them as Kubernetes resources to the unified storage bulk process API.
func (m *snapshotMigrator) MigrateSnapshots(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating snapshots...")

	var lastID int64 = 0
	limit := int64(1000)
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

		var id int64
		var orgID int64
		var name, key, deleteKey string
		var userID int64
		var external bool
		var externalURL string
		var dashboard string
		var dashboardEncrypted []byte
		var expires, created, updated time.Time

		rawRows := make([]snapshotRow, 0, limit)
		for rows.Next() {
			err = rows.Scan(
				&id, &orgID, &name, &key, &deleteKey, &userID,
				&external, &externalURL, &dashboard, &dashboardEncrypted,
				&expires, &created, &updated,
			)
			if err != nil {
				_ = rows.Close()
				return err
			}

			lastID = id
			rawRows = append(rawRows, snapshotRow{
				name:               name,
				key:                key,
				deleteKey:          deleteKey,
				userID:             userID,
				external:           external,
				externalURL:        externalURL,
				dashboard:          dashboard,
				dashboardEncrypted: append([]byte(nil), dashboardEncrypted...),
				expires:            expires,
				created:            created,
				updated:            updated,
			})
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
					ResourceVersion:   fmt.Sprintf("%d", row.updated.UnixMilli()),
					CreationTimestamp: metav1.NewTime(row.created),
				},
				Spec: dashV0.SnapshotSpec{
					Title:     &row.name,
					DeleteKey: &row.deleteKey,
				},
			}

			if row.external {
				snap.Spec.External = &row.external
				snap.Spec.ExternalUrl = &row.externalURL
			}

			// The legacy "never expires" sentinel is set 50 years into the future; skip
			// those so the migrated resource doesn't carry a meaningless expiry.
			if !row.expires.After(time.Date(2070, time.January, 1, 0, 0, 0, 0, time.UTC)) {
				expiresMs := row.expires.UnixMilli()
				if expiresMs > 0 {
					snap.Spec.Expires = &expiresMs
				}
			}

			if dash, err := m.resolveDashboard(ctx, row); err != nil {
				return fmt.Errorf("decrypting snapshot %s: %w", row.key, err)
			} else if len(dash) > 0 {
				snap.Spec.Dashboard = dash
			}

			if row.userID > 0 {
				snap.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(row.userID, 10)))
			}

			if !row.updated.Equal(row.created) {
				meta, _ := utils.MetaAccessor(snap)
				meta.SetUpdatedTimestamp(&row.updated)
			}

			body, err := json.Marshal(snap)
			if err != nil {
				return err
			}

			req := &resourcepb.BulkRequest{
				Key: &resourcepb.ResourceKey{
					Namespace: opts.Namespace,
					Group:     dashV0.APIGroup,
					Resource:  "snapshots",
					Name:      row.key,
				},
				Value:  body,
				Action: resourcepb.BulkRequest_ADDED,
			}
			chunk = append(chunk, req)
		}
		convertDuration += time.Since(convertStart)

		writeStart := time.Now()
		for _, req := range chunk {
			count++
			err = stream.Send(req)
			if err != nil {
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

	opts.Progress(count, fmt.Sprintf("finished reading legacy snapshots from legacy dashboard_snapshot table in %s (%d)", readDuration, count))
	opts.Progress(count, fmt.Sprintf("finished converting legacy snapshots to unified storage format in %s (%d)", convertDuration, count))
	opts.Progress(count, fmt.Sprintf("finished writing snapshots to unified storage in %s (%d)", writeDuration, count))
	opts.Progress(-2, fmt.Sprintf("finished snapshots... (%d)", count))
	return nil
}

// resolveDashboard returns the snapshot's dashboard JSON as a map, decrypting the
// encrypted blob when present. Falls back to the plaintext column for older rows
// written before envelope encryption was introduced.
func (m *snapshotMigrator) resolveDashboard(ctx context.Context, row snapshotRow) (map[string]interface{}, error) {
	if len(row.dashboardEncrypted) > 0 {
		plaintext, err := m.secretsService.Decrypt(ctx, row.dashboardEncrypted)
		if err != nil {
			// A snapshot whose encryption key is no longer recoverable would
			// otherwise abort the whole migration. Log and continue with an empty
			// dashboard so the rest of the snapshot metadata is preserved.
			logger.Warn("could not decrypt snapshot dashboard; migrating without dashboard body", "key", row.key, "err", err)
			return nil, nil
		}
		var d map[string]interface{}
		if err := json.Unmarshal(plaintext, &d); err != nil {
			return nil, err
		}
		return d, nil
	}
	if row.dashboard == "" {
		return nil, nil
	}
	var d map[string]interface{}
	if err := json.Unmarshal([]byte(row.dashboard), &d); err != nil {
		return nil, err
	}
	return d, nil
}

type snapshotRow struct {
	name               string
	key                string
	deleteKey          string
	userID             int64
	external           bool
	externalURL        string
	dashboard          string
	dashboardEncrypted []byte
	expires            time.Time
	created            time.Time
	updated            time.Time
}

func (m *snapshotMigrator) listSnapshots(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
	if m.listSnapshotsFn != nil {
		return m.listSnapshotsFn(ctx, orgID, lastID, limit)
	}
	return m.ListSnapshots(ctx, orgID, lastID, limit)
}

func (m *snapshotMigrator) ListSnapshots(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
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
	Query *SnapshotQuery

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
