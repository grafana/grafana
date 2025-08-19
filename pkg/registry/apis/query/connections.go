package query

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	queryV0 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	_ rest.Scoper               = (*connectionAccess)(nil)
	_ rest.SingularNameProvider = (*connectionAccess)(nil)
	_ rest.Getter               = (*connectionAccess)(nil)
	_ rest.Lister               = (*connectionAccess)(nil)
	_ rest.Storage              = (*connectionAccess)(nil)
)

// Get all datasource connections -- this will be backed by search or duplicated resource in unified storage
// TODO: name vs uid? name across all groups not unique! must be different... use labels?
type DataSourceConnectionProvider interface {
	// Get gets a specific datasource (that the user in context can see)
	GetConnection(ctx context.Context, namespace string, name string) (*queryV0.DataSourceConnection, error)

	// List lists all data sources the user in context can see
	ListConnections(ctx context.Context, namespace string) (*queryV0.DataSourceConnectionList, error)
}

type connectionAccess struct {
	tableConverter rest.TableConvertor
	connections    DataSourceConnectionProvider
}

func (s *connectionAccess) New() runtime.Object {
	return queryV0.ConnectionResourceInfo.NewFunc()
}

func (s *connectionAccess) Destroy() {}

func (s *connectionAccess) NamespaceScoped() bool {
	return true
}

func (s *connectionAccess) GetSingularName() string {
	return queryV0.ConnectionResourceInfo.GetSingularName()
}

func (s *connectionAccess) ShortNames() []string {
	return queryV0.ConnectionResourceInfo.GetShortNames()
}

func (s *connectionAccess) NewList() runtime.Object {
	return queryV0.ConnectionResourceInfo.NewListFunc()
}

func (s *connectionAccess) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.tableConverter == nil {
		s.tableConverter = queryV0.ConnectionResourceInfo.TableConverter()
	}
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *connectionAccess) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.connections.GetConnection(ctx, request.NamespaceValue(ctx), name)
}

func (s *connectionAccess) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.connections.ListConnections(ctx, request.NamespaceValue(ctx))
}

type connectionsProvider struct {
	dsService datasources.DataSourceService
	registry  queryV0.DataSourceApiServerRegistry
}

var (
	_ DataSourceConnectionProvider = (*connectionsProvider)(nil)
)

func (q *connectionsProvider) GetConnection(ctx context.Context, namespace string, name string) (*queryV0.DataSourceConnection, error) {
	info, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		UID:   name,
		OrgID: info.OrgID,
	})
	if err != nil {
		return nil, err
	}

	// TODO... access control?
	return q.asConnection(ds, namespace)
}

func (q *connectionsProvider) ListConnections(ctx context.Context, namespace string) (*queryV0.DataSourceConnectionList, error) {
	info, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID:           info.OrgID,
		DataSourceLimit: 10000,
	})
	if err != nil {
		return nil, err
	}
	result := &queryV0.DataSourceConnectionList{
		Items: []queryV0.DataSourceConnection{},
	}
	for _, ds := range dss {
		// TODO, access control?!
		v, err := q.asConnection(ds, namespace)
		if err != nil {
			return nil, err
		}
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

func (q *connectionsProvider) asConnection(ds *datasources.DataSource, ns string) (v *queryV0.DataSourceConnection, err error) {
	gv, err := q.registry.GetDatasourceGroupVersion(ds.Type)
	if err != nil {
		// how does this happen? (grafana-e2etest-datasource)
		gv = schema.GroupVersion{
			Group:   "unknown-" + ds.Type,
			Version: "unknown",
		}
		err = nil
	}

	v = &queryV0.DataSourceConnection{
		ObjectMeta: metav1.ObjectMeta{
			Name:              queryV0.DataSourceConnectionName(gv.Group, ds.UID),
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Title: ds.Name,
		Datasource: queryV0.DataSourceConnectionRef{
			Group:    gv.Group,
			Version:  gv.Version,
			Name:     ds.UID,
			PluginID: ds.Type,
		},
	}
	v.UID = gapiutil.CalculateClusterWideUID(v) // indicates if the value changed on the server
	if !ds.Updated.IsZero() {
		meta, err := utils.MetaAccessor(v)
		if err != nil {
			meta.SetUpdatedTimestamp(&ds.Updated)
		}
	}
	return v, err
}
