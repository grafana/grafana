package migrator

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"text/template"
	"time"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//go:embed query_correlations.sql
var correlationSQLTemplatesFS embed.FS

var sqlQueryCorrelations = template.Must(
	template.New("sql").ParseFS(correlationSQLTemplatesFS, "query_correlations.sql"),
).Lookup("query_correlations.sql")

// CorrelationMigrator defines the interface for migrating correlations from legacy storage.
type CorrelationMigrator interface {
	MigrateCorrelations(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

// correlationMigrator handles migrating correlations from legacy SQL storage.
type correlationMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideCorrelationMigrator creates a correlationMigrator for use in wire DI.
func ProvideCorrelationMigrator(sql legacysql.LegacyDatabaseProvider) CorrelationMigrator {
	return &correlationMigrator{sql: sql}
}

// MigrateCorrelations handles the correlation migration logic.
func (m *correlationMigrator) MigrateCorrelations(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating correlations...")

	var lastUID string
	limit := int64(1000)
	count := 0
	readDuration := time.Duration(0)
	convertDuration := time.Duration(0)
	writeDuration := time.Duration(0)

	for {
		readStart := time.Now()
		rows, err := m.listCorrelations(ctx, orgId, lastUID, limit)
		if err != nil {
			return err
		}

		rawRows := make([]correlationRow, 0, limit)
		for rows.Next() {
			var row correlationRow
			err = rows.Scan(
				&row.uid,
				&row.orgID,
				&row.sourceUID,
				&row.targetUID,
				&row.label,
				&row.description,
				&row.config,
				&row.provisioned,
				&row.correlationType,
				&row.sourceType,
				&row.targetType,
			)
			if err != nil {
				_ = rows.Close()
				return err
			}

			lastUID = row.uid
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
			legacyCorrelation, err := row.toLegacyCorrelation()
			if err != nil {
				return fmt.Errorf("failed to parse correlation row %s: %w", row.uid, err)
			}

			k8sObj, err := correlations.ToResource(*legacyCorrelation)
			if err != nil {
				return fmt.Errorf("failed to convert correlation %s to k8s resource: %w", row.uid, err)
			}

			// Set TypeMeta so CalculateClusterWideUID can derive group/kind,
			// then assign a deterministic metadata.uid.
			k8sObj.TypeMeta = metav1.TypeMeta{
				APIVersion: correlationsV0.GroupVersion.String(),
				Kind:       "Correlation",
			}
			k8sObj.UID = utils.CalculateClusterWideUID(k8sObj)

			body, err := json.Marshal(k8sObj)
			if err != nil {
				return fmt.Errorf("failed to marshal correlation %s: %w", row.uid, err)
			}

			req := &resourcepb.BulkRequest{
				Key: &resourcepb.ResourceKey{
					Namespace: opts.Namespace,
					Group:     correlationsV0.APIGroup,
					Resource:  "correlations",
					Name:      row.uid,
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

	opts.Progress(count, fmt.Sprintf("finished reading legacy correlations from legacy correlation table in %s (%d)", readDuration, count))
	opts.Progress(count, fmt.Sprintf("finished converting legacy correlations to unified storage format in %s (%d)", convertDuration, count))
	opts.Progress(count, fmt.Sprintf("finished writing correlations to unified storage in %s (%d)", writeDuration, count))
	opts.Progress(-2, fmt.Sprintf("finished correlations... (%d)", count))
	return nil
}

// correlationRow holds a single row from the legacy correlation table.
type correlationRow struct {
	uid             string
	orgID           int64
	sourceUID       string
	targetUID       sql.NullString
	label           string
	description     string
	config          string
	provisioned     bool
	correlationType string
	sourceType      sql.NullString
	targetType      sql.NullString
}

// toLegacyCorrelation converts a database row to the legacy Correlation model,
// which can then be converted to a K8s resource using correlations.ToResource.
func (r *correlationRow) toLegacyCorrelation() (*correlations.Correlation, error) {
	c := &correlations.Correlation{
		UID:         r.uid,
		SourceUID:   r.sourceUID,
		OrgID:       r.orgID,
		Label:       r.label,
		Description: r.description,
		Provisioned: r.provisioned,
		Type:        correlations.CorrelationType(r.correlationType),
	}

	if r.sourceType.Valid {
		c.SourceType = &r.sourceType.String
	}
	if r.targetUID.Valid {
		c.TargetUID = &r.targetUID.String
	}
	if r.targetType.Valid {
		c.TargetType = &r.targetType.String
	}

	if r.config != "" {
		if err := json.Unmarshal([]byte(r.config), &c.Config); err != nil {
			return nil, fmt.Errorf("unmarshal config: %w", err)
		}
	}

	return c, nil
}

func (m *correlationMigrator) listCorrelations(ctx context.Context, orgID int64, lastUID string, limit int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newCorrelationQueryReq(helper, &CorrelationQuery{
		OrgID:   orgID,
		LastUID: lastUID,
		Limit:   limit,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryCorrelations, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryCorrelations.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

// CorrelationQuery holds query parameters for listing correlations.
type CorrelationQuery struct {
	OrgID   int64
	LastUID string
	Limit   int64
}

type sqlCorrelationQuery struct {
	sqltemplate.SQLTemplate
	Query *CorrelationQuery

	CorrelationTable string
	DataSourceTable  string
}

func (r sqlCorrelationQuery) Validate() error {
	return nil
}

func newCorrelationQueryReq(sql *legacysql.LegacyDatabaseHelper, query *CorrelationQuery) sqlCorrelationQuery {
	return sqlCorrelationQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		Query:       query,

		CorrelationTable: sql.Table("correlation"),
		DataSourceTable:  sql.Table("data_source"),
	}
}
