package query

import (
	"context"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	queryV0 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type connectionsProvider struct {
	dsService datasources.DataSourceService
	registry  queryV0.DataSourceApiServerRegistry
}

var (
	// TODO: After https://github.com/grafana/grafana/pull/116745 is merged
	// the datasources.DataSourceService can implement this interface directly.
	_ queryV0.DataSourceConnectionProvider = (*connectionsProvider)(nil)
)

func (q *connectionsProvider) ListConnections(ctx context.Context, query queryV0.DataSourceConnectionQuery) (*queryV0.DataSourceConnectionList, error) {
	ns, err := authlib.ParseNamespace(query.Namespace)
	if err != nil {
		return nil, err
	}
	result := &queryV0.DataSourceConnectionList{
		TypeMeta: v1.TypeMeta{
			APIVersion: queryV0.SchemeGroupVersion.String(),
			Kind:       "DataSourceConnectionList",
		},
		Items: []queryV0.DataSourceConnection{},
	}

	if query.Name != "" {
		dss, err := q.dsService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
			OrgID: ns.OrgID,
			UID:   query.Name,
		})
		if err != nil {
			return nil, err
		}
		if dss != nil {
			v, err := q.asConnection(dss)
			if err != nil {
				return nil, err
			}
			result.Items = append(result.Items, *v)
		}
		return result, nil
	}

	// Do a full query
	dss, err := q.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID:           ns.OrgID,
		DataSourceLimit: 10000,
	})
	if err != nil {
		return nil, err
	}
	for _, ds := range dss {
		if query.Plugin != "" && ds.Type != query.Plugin {
			continue
		}
		v, err := q.asConnection(ds)
		if err != nil {
			return nil, err
		}
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

func (q *connectionsProvider) asConnection(ds *datasources.DataSource) (v *queryV0.DataSourceConnection, err error) {
	gv, _ := q.registry.GetDatasourceGroupVersion(ds.Type)
	return &queryV0.DataSourceConnection{
		Title:      ds.Name,
		APIGroup:   gv.Group,
		APIVersion: gv.Version,
		Name:       ds.UID,
		Plugin:     ds.Type,
	}, nil
}
