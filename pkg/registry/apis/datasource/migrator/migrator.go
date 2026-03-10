package migrator

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"maps"
	"strconv"
	"text/template"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed query_datasources.sql
var datasourceSQLTemplatesFS embed.FS

var sqlQueryDataSources = template.Must(
	template.New("sql").ParseFS(datasourceSQLTemplatesFS, "query_datasources.sql"),
).Lookup("query_datasources.sql")

// DataSourceMigrator handles migrating datasources from legacy SQL storage.
type DataSourceMigrator interface {
	MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

type dataSourceMigrator struct {
	sql legacysql.LegacyDatabaseProvider
}

// ProvideDataSourceMigrator creates a dataSourceMigrator for use in wire DI.
func ProvideDataSourceMigrator(sql legacysql.LegacyDatabaseProvider) DataSourceMigrator {
	return &dataSourceMigrator{sql: sql}
}

// MigrateDataSources reads datasources from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API. It handles all plugin
// types found in the database, grouping by type and using per-plugin converters.
func (m *dataSourceMigrator) MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating datasources...")
	rows, err := m.listDataSources(ctx, orgId)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return err
	}

	mapper := request.GetNamespaceMapper(nil)

	count := 0
	for rows.Next() {
		ds, err := scanDataSource(rows)
		if err != nil {
			return fmt.Errorf("scanning datasource row: %w", err)
		}

		group := ds.Type + ".datasource.grafana.app"

		obj, err := asDataSource(ds, mapper, group)
		if err != nil {
			return fmt.Errorf("converting datasource %s (type=%s): %w", ds.UID, ds.Type, err)
		}

		// Set TypeMeta with the per-plugin group
		obj.TypeMeta = metav1.TypeMeta{
			APIVersion: group + "/" + datasourceV0.VERSION,
			Kind:       "DataSource",
		}

		body, err := json.Marshal(obj)
		if err != nil {
			return fmt.Errorf("marshaling datasource %s: %w", ds.UID, err)
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     group,
				Resource:  "datasources",
				Name:      ds.UID,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s/%s (%d)", ds.Type, ds.Name, len(req.Value)))
		count++

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	if err = rows.Err(); err != nil {
		return err
	}

	opts.Progress(-2, fmt.Sprintf("finished datasources... (%d)", count))
	return nil
}

// asDataSource converts a legacy DataSource model to a K8s DataSource object.
// This mirrors the logic in datasource.Converter.AsDataSource but is inlined here
// to avoid an import cycle between the datasource and migrator packages.
func asDataSource(ds *datasources.DataSource, mapper request.NamespaceMapper, group string) (*datasourceV0.DataSource, error) {
	secureKeys := toInlineSecureValues(ds.UID, maps.Keys(ds.SecureJsonData))
	obj := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:       ds.UID,
			Namespace:  mapper(ds.OrgID),
			Generation: int64(ds.Version),
		},
		Spec:   datasourceV0.UnstructuredSpec{},
		Secure: secureKeys,
	}
	obj.UID = gapiutil.CalculateClusterWideUID(obj)
	obj.Spec.SetTitle(ds.Name).
		SetAccess(string(ds.Access)).
		SetURL(ds.URL).
		SetDatabase(ds.Database).
		SetUser(ds.User).
		SetBasicAuth(ds.BasicAuth).
		SetBasicAuthUser(ds.BasicAuthUser).
		SetWithCredentials(ds.WithCredentials).
		SetIsDefault(ds.IsDefault).
		SetReadOnly(ds.ReadOnly)

	if ds.JsonData != nil && !ds.JsonData.IsEmpty() {
		obj.Spec.SetJSONData(ds.JsonData.Interface())
	}

	rv := int64(0)
	if !ds.Created.IsZero() {
		obj.CreationTimestamp = metav1.NewTime(ds.Created)
		rv = ds.Created.UnixMilli()
	}

	if !ds.Updated.IsZero() {
		rv = ds.Updated.UnixMilli()
		delta := rv - obj.CreationTimestamp.UnixMilli()
		if delta > 1500 {
			obj.Annotations = map[string]string{
				utils.AnnoKeyUpdatedTimestamp: ds.Updated.UTC().Format(time.RFC3339),
			}
		}
	}

	if rv > 0 {
		obj.ResourceVersion = strconv.FormatInt(rv, 10)
	}

	if ds.APIVersion != "" {
		obj.APIVersion = fmt.Sprintf("%s/%s", group, ds.APIVersion)
	}

	if ds.ID > 0 {
		obj.Labels = map[string]string{
			utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(ds.ID, 10),
		}
	}
	return obj, nil
}

// toInlineSecureValues mirrors datasource.ToInlineSecureValues to avoid import cycle.
func toInlineSecureValues(dsUID string, keys iter.Seq[string]) common.InlineSecureValues {
	values := make(common.InlineSecureValues)
	for k := range keys {
		h := sha256.New()
		h.Write([]byte(dsUID))
		h.Write([]byte("|"))
		h.Write([]byte(k))
		values[k] = common.InlineSecureValue{
			Name: apistore.LEGACY_DATASOURCE_SECURE_VALUE_NAME_PREFIX + hex.EncodeToString(h.Sum(nil)),
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

func scanDataSource(rows *sql.Rows) (*datasources.DataSource, error) {
	ds := &datasources.DataSource{}
	var jsonDataBytes []byte
	var secureJsonDataBytes []byte
	var created, updated time.Time

	err := rows.Scan(
		&ds.ID, &ds.OrgID, &ds.Version, &ds.Type, &ds.Name, &ds.Access, &ds.URL,
		&ds.User, &ds.Database, &ds.BasicAuth, &ds.BasicAuthUser,
		&jsonDataBytes, &secureJsonDataBytes, &ds.WithCredentials,
		&ds.IsDefault, &ds.ReadOnly, &ds.UID, &created, &updated,
	)
	if err != nil {
		return nil, err
	}

	ds.Created = created
	ds.Updated = updated

	if len(jsonDataBytes) > 0 {
		ds.JsonData, err = simplejson.NewJson(jsonDataBytes)
		if err != nil {
			ds.JsonData = simplejson.New()
		}
	}

	// Parse secure_json_data - we only need the keys, not the encrypted values
	if len(secureJsonDataBytes) > 0 {
		var secureKeys map[string][]byte
		if err := json.Unmarshal(secureJsonDataBytes, &secureKeys); err == nil {
			ds.SecureJsonData = secureKeys
		}
	}

	return ds, nil
}

type dataSourceQuery struct {
	OrgID int64
}

type sqlDataSourceQuery struct {
	sqltemplate.SQLTemplate
	Query *dataSourceQuery

	DataSourceTable string
}

func (r sqlDataSourceQuery) Validate() error {
	return nil
}

func newDataSourceQueryReq(sql *legacysql.LegacyDatabaseHelper, query *dataSourceQuery) sqlDataSourceQuery {
	return sqlDataSourceQuery{
		SQLTemplate:     sqltemplate.New(sql.DialectForDriver()),
		Query:           query,
		DataSourceTable: sql.Table("data_source"),
	}
}

func (m *dataSourceMigrator) listDataSources(ctx context.Context, orgID int64) (*sql.Rows, error) {
	helper, err := m.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newDataSourceQueryReq(helper, &dataSourceQuery{
		OrgID: orgID,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryDataSources, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryDataSources.Name(), err)
	}

	return helper.DB.GetSqlxSession().Query(ctx, rawQuery, req.GetArgs()...)
}
