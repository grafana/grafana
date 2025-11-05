package mocksvcs

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
)

var dss = map[string]*datasources.DataSource{
	"prometheus-uid": {
		ID:   1,
		UID:  "prometheus-uid",
		Name: "Prometheus",
		Type: "prometheus",
	},
	"mysql-uid": {
		ID:   2,
		UID:  "mysql-uid",
		Name: "MySQL",
		Type: "mysql",
	},
	"unknown-uid": {
		ID:   3,
		UID:  "unknown-uid",
		Name: "Unknown",
		Type: "unknown",
	},
}

type DatasourceSvc struct {
	datasources.DataSourceService
}

func (m *DatasourceSvc) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error) {
	sources := make([]*datasources.DataSource, 0, len(dss))
	for _, ds := range dss {
		sources = append(sources, ds)
	}
	return sources, nil
}

func (m *DatasourceSvc) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return dss[query.UID], nil
}
