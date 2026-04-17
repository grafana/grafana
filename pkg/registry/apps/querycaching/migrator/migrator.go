package migrator

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"text/template"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const (
	apiGroup   = "querycaching.grafana.app"
	apiVersion = "v1beta1"
	resource   = "querycacheconfigs"
)

//go:embed query_querycacheconfigs.sql
var sqlTemplatesFS embed.FS

var sqlQueryCacheConfigs = template.Must(
	template.New("sql").ParseFS(sqlTemplatesFS, "query_querycacheconfigs.sql"),
).Lookup("query_querycacheconfigs.sql")

// QueryCacheConfigMigrator migrates query cache configs from legacy SQL to unified storage.
type QueryCacheConfigMigrator interface {
	MigrateQueryCacheConfigs(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

type queryCacheConfigMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideQueryCacheConfigMigrator creates a queryCacheConfigMigrator for use in wire DI.
func ProvideQueryCacheConfigMigrator(sql legacysql.LegacyDatabaseProvider) QueryCacheConfigMigrator {
	return &queryCacheConfigMigrator{sql: sql}
}

func (m *queryCacheConfigMigrator) MigrateQueryCacheConfigs(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating query cache configs...")

	var lastID int64
	const limit = int64(1000)
	var count int

	for {
		rows, err := m.listConfigs(ctx, orgId, lastID, limit)
		if err != nil {
			return err
		}

		n := 0
		for rows.Next() {
			var row cacheConfigRow
			if err = rows.Scan(&row.id, &row.dataSourceUID, &row.enabled, &row.ttlMS,
				&row.ttlResourcesMS, &row.useDefaultTTL, &row.createdEpoch,
				&row.pluginID, &row.orgID); err != nil {
				_ = rows.Close()
				return err
			}
			lastID = row.id
			n++

			name := fmt.Sprintf("%s.%s", row.pluginID, row.dataSourceUID)
			body, err := json.Marshal(queryCacheConfigObject{
				TypeMeta:   metav1.TypeMeta{APIVersion: apiGroup + "/" + apiVersion, Kind: "QueryCacheConfig"},
				ObjectMeta: objectMeta{Name: name, Namespace: opts.Namespace, CreationTimestamp: metav1.NewTime(time.Unix(row.createdEpoch, 0))},
				Spec: queryCacheConfigSpec{
					DatasourceUID:  row.dataSourceUID,
					PluginID:       row.pluginID,
					Enabled:        row.enabled,
					TtlQueriesMs:   row.ttlMS,
					TtlResourcesMs: row.ttlResourcesMS,
					UseDefaultTtl:  row.useDefaultTTL,
				},
			})
			if err != nil {
				_ = rows.Close()
				return err
			}

			if err = stream.Send(&resourcepb.BulkRequest{
				Key: &resourcepb.ResourceKey{
					Namespace: opts.Namespace,
					Group:     apiGroup,
					Resource:  resource,
					Name:      name,
				},
				Value:  body,
				Action: resourcepb.BulkRequest_ADDED,
			}); err != nil {
				_ = rows.Close()
				return err
			}
			count++
		}

		if err = rows.Err(); err != nil {
			_ = rows.Close()
			return err
		}
		_ = rows.Close()
		if int64(n) < limit {
			break
		}
	}

	opts.Progress(-2, fmt.Sprintf("finished query cache configs (%d)", count))
	return nil
}

// objectMeta holds the minimal ObjectMeta fields needed for the migration.
type objectMeta struct {
	Name              string      `json:"name"`
	Namespace         string      `json:"namespace"`
	CreationTimestamp metav1.Time `json:"creationTimestamp"`
}

// queryCacheConfigSpec mirrors querycaching/v1beta1.QueryCacheConfigSpec.
// Keep in sync with pkg/extensions/apps/querycaching/pkg/apis/querycaching/v1beta1/querycacheconfig_spec_gen.go.
type queryCacheConfigSpec struct {
	DatasourceUID  string `json:"datasource_uid"`
	PluginID       string `json:"plugin_id"`
	Enabled        bool   `json:"enabled"`
	TtlQueriesMs   int64  `json:"ttl_queries_ms"`
	TtlResourcesMs int64  `json:"ttl_resources_ms"`
	UseDefaultTtl  bool   `json:"use_default_ttl"`
}

// queryCacheConfigObject is the full K8s-style object sent to unified storage.
type queryCacheConfigObject struct {
	metav1.TypeMeta `json:",inline"`
	ObjectMeta      objectMeta           `json:"metadata"`
	Spec            queryCacheConfigSpec `json:"spec"`
}

type cacheConfigRow struct {
	id             int64
	dataSourceUID  string
	enabled        bool
	ttlMS          int64
	ttlResourcesMS int64
	useDefaultTTL  bool
	createdEpoch   int64
	pluginID       string
	orgID          int64
}

func (m *queryCacheConfigMigrator) listConfigs(ctx context.Context, orgID int64, lastID int64, limit int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newQueryReq(helper, &queryCacheConfigQuery{
		OrgID:  orgID,
		LastID: lastID,
		Limit:  limit,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryCacheConfigs, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryCacheConfigs.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}

type queryCacheConfigQuery struct {
	OrgID  int64
	LastID int64
	Limit  int64
}

type sqlQueryCacheConfig struct {
	sqltemplate.SQLTemplate
	Query *queryCacheConfigQuery

	CacheTable      string
	DataSourceTable string
}

func (r sqlQueryCacheConfig) Validate() error {
	return nil
}

func newQueryReq(sql *legacysql.LegacyDatabaseHelper, query *queryCacheConfigQuery) sqlQueryCacheConfig {
	return sqlQueryCacheConfig{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		Query:           query,
		CacheTable:      sql.Table("data_source_cache"),
		DataSourceTable: sql.Table("data_source"),
	}
}
