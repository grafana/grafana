package query

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
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
	return query.ConnectionResourceInfo.NewFunc()
}

func (s *connectionAccess) Destroy() {}

func (s *connectionAccess) NamespaceScoped() bool {
	return true
}

func (s *connectionAccess) GetSingularName() string {
	return query.ConnectionResourceInfo.GetSingularName()
}

func (s *connectionAccess) ShortNames() []string {
	return query.ConnectionResourceInfo.GetShortNames()
}

func (s *connectionAccess) NewList() runtime.Object {
	return query.ConnectionResourceInfo.NewListFunc()
}

func (s *connectionAccess) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.tableConverter == nil {
		s.tableConverter = query.ConnectionResourceInfo.TableConverter()
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
}

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

	return asConnection(ds, namespace)
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
		// TODO, access control!
		v, _ := asConnection(ds, namespace)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

func asConnection(ds *datasources.DataSource, ns string) (*queryV0.DataSourceConnection, error) {
	v := &queryV0.DataSourceConnection{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Title: ds.Name,
	}
	v.UID = gapiutil.CalculateClusterWideUID(v) // indicates if the value changed on the server
	meta, err := utils.MetaAccessor(v)
	if err != nil {
		meta.SetUpdatedTimestamp(&ds.Updated)
	}
	return v, err
}
