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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// CorrelationsMigrator handles migrating correlations from legacy SQL storage.
type CorrelationsMigrator interface {
	MigrateCorrelations(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

type correlationsMigrator struct {
	sql                legacysql.LegacyDatabaseProvider
	listCorrelationsFn func(context.Context, int64, string, int64) (*sql.Rows, error)
}

// ProvideCorrelationsMigrator creates a correlationsMigrator for use in wire DI.
func ProvideCorrelationsMigrator(sql legacysql.LegacyDatabaseProvider) CorrelationsMigrator {
	return &correlationsMigrator{sql: sql}
}

// MigrateCorrelations handles the correlation migration logic.
func (m *correlationsMigrator) MigrateCorrelations(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
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
			var targetUID sql.NullString
			var config sql.NullString

			err = rows.Scan(
				&row.uid,
				&row.orgID,
				&row.sourceUID,
				&targetUID,
				&row.label,
				&row.description,
				&config,
				&row.provisioned,
				&row.correlationType,
			)
			if err != nil {
				_ = rows.Close()
				return err
			}

			if targetUID.Valid {
				row.targetUID = &targetUID.String
			}
			if config.Valid {
				row.config = config.String
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
			obj, err := toCorrelationResource(row, opts.Namespace)
			if err != nil {
				return fmt.Errorf("converting correlation %s: %w", row.uid, err)
			}

			body, err := json.Marshal(obj)
			if err != nil {
				return err
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

type correlationRow struct {
	uid             string
	orgID           int64
	sourceUID       string
	targetUID       *string
	label           string
	description     string
	config          string
	provisioned     bool
	correlationType string
}

func toCorrelationResource(row correlationRow, namespace string) (*correlationsV0.Correlation, error) {
	// Parse the config JSON
	var legacyConfig correlations.CorrelationConfig
	if row.config != "" {
		if err := json.Unmarshal([]byte(row.config), &legacyConfig); err != nil {
			return nil, fmt.Errorf("unmarshaling config: %w", err)
		}
	}

	specConfig, err := correlations.ToSpecConfig(legacyConfig)
	if err != nil {
		return nil, fmt.Errorf("converting config: %w", err)
	}

	obj := &correlationsV0.Correlation{
		TypeMeta: metav1.TypeMeta{
			APIVersion: correlationsV0.GroupVersion.String(),
			Kind:       "Correlation",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      row.uid,
			Namespace: namespace,
		},
		Spec: correlationsV0.CorrelationSpec{
			Type:  correlationsV0.CorrelationCorrelationType(row.correlationType),
			Label: row.label,
			Source: correlationsV0.CorrelationDataSourceRef{
				Name: row.sourceUID,
			},
			Config: *specConfig,
		},
	}

	if row.targetUID != nil {
		obj.Spec.Target = &correlationsV0.CorrelationDataSourceRef{
			Name: *row.targetUID,
		}
	}

	if row.description != "" {
		obj.Spec.Description = &row.description
	}

	if row.provisioned {
		tmp, _ := utils.MetaAccessor(obj)
		tmp.SetManagerProperties(utils.ManagerProperties{
			Kind: utils.ManagerKindClassicFP, //nolint:staticcheck
		})
	}

	return obj, nil
}

func (m *correlationsMigrator) listCorrelations(ctx context.Context, orgID int64, lastUID string, limit int64) (*sql.Rows, error) {
	if m.listCorrelationsFn != nil {
		return m.listCorrelationsFn(ctx, orgID, lastUID, limit)
	}
	return m.ListCorrelations(ctx, orgID, lastUID, limit)
}

// ListCorrelations queries the legacy correlation table.
func (m *correlationsMigrator) ListCorrelations(ctx context.Context, orgID int64, lastUID string, limit int64) (*sql.Rows, error) {
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

// CorrelationQuery holds the query parameters for listing correlations.
type CorrelationQuery struct {
	OrgID   int64
	LastUID string
	Limit   int64
}

type sqlCorrelationQuery struct {
	sqltemplate.SQLTemplate
	Query *CorrelationQuery

	CorrelationTable string
}

func (r sqlCorrelationQuery) Validate() error {
	return nil
}

func newCorrelationQueryReq(sql *legacysql.LegacyDatabaseHelper, query *CorrelationQuery) sqlCorrelationQuery {
	return sqlCorrelationQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		Query:            query,
		CorrelationTable: sql.Table("correlation"),
	}
}
