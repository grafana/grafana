package alt

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
)

func ProvideSQLBasedPluginConfigs(sql db.DB) datasource.PluginConfigProvider {
	return &sqlPluginConfigProvider{
		sql: sql,
	}
}

type sqlPluginConfigProvider struct {
	sql db.DB
}

func (q *sqlPluginConfigProvider) GetDataSource(ctx context.Context, pluginID, uid string) (*v0alpha1.DataSourceConnection, error) {
	all, err := q.ListDatasources(ctx, pluginID)
	if err != nil {
		return nil, err
	}
	for idx, ds := range all.Items {
		if ds.Name == uid {
			return &all.Items[idx], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (q *sqlPluginConfigProvider) ListDatasources(ctx context.Context, pluginID string) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	// :( alias support
	typeFilter := "= " + pluginID
	if pluginID == "grafana-testdata-datasource" {
		typeFilter = "in ('grafana-testdata-datasource', 'testdata')"
	}

	dss := &v0alpha1.DataSourceConnectionList{
		ListMeta: v1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
	}
	rows, err := q.sql.GetSqlxSession().Query(ctx, "SELECT uid,name,created,updated FROM data_source WHERE org_id=? AND "+q.sql.Quote("type")+typeFilter, info.OrgID)
	if err != nil {
		return nil, err
	}

	created := time.Time{}
	updated := time.Time{}

	for rows.Next() {
		ds := v0alpha1.DataSourceConnection{}
		err = rows.Scan(&ds.Name, &ds.Title, &created, &updated)
		if err != nil {
			return nil, err
		}
		ds.Namespace = info.Value // the request raw namespace
		ds.CreationTimestamp = v1.NewTime(created)
		ds.ResourceVersion = fmt.Sprintf("%d", updated.UnixMilli())
		ds.UID = utils.CalculateClusterWideUID(&ds) // indicates if the value changed on the server
		meta, err := utils.MetaAccessor(&ds)
		if err != nil {
			meta.SetUpdatedTimestamp(&updated)
		}
		dss.Items = append(dss.Items, ds)
	}

	return dss, nil
}

func (q *sqlPluginConfigProvider) GetDataSourceInstanceSettings(ctx context.Context, pluginID, uid string) (*backend.DataSourceInstanceSettings, error) {
	// TODO!! NOTE, this only works with testdata for now
	return &backend.DataSourceInstanceSettings{}, nil
}
