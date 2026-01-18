package query

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
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
type DataSourceConnectionProvider interface {
	// Get gets a specific datasource (that the user in context can see)
	// The name is {group}:{name}, see /pkg/apis/query/v0alpha1/connection.go#L34
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
	if !options.LabelSelector.Empty() {
		return nil, fmt.Errorf("label selector is not yet supported")
	}
	ns := request.NamespaceValue(ctx)
	if !options.FieldSelector.Empty() {
		requirements := options.FieldSelector.Requirements()
		if len(requirements) > 1 {
			return nil, fmt.Errorf("only a single field selector is supported")
		}

		obj := &queryV0.DataSourceConnectionList{}
		for _, requirement := range requirements {
			if requirement.Operator != selection.Equals {
				return nil, fmt.Errorf("only the equals field selector operation is supported")
			}
			switch requirement.Field {
			case "metadata.name":
				v, _ := s.connections.GetConnection(ctx, ns, requirement.Value)
				if v != nil { // ignore error + not found
					obj.Items = []queryV0.DataSourceConnection{*v}
				}
			case "datasource.name":
				all, err := s.connections.ListConnections(ctx, ns)
				if err != nil {
					return nil, err
				}
				for _, v := range all.Items {
					if v.Datasource.Name == requirement.Value {
						obj.Items = append(obj.Items, v)
					}
				}
			default:
				return nil, fmt.Errorf("invalid field selector")
			}
		}
		return obj, nil
	}

	return s.connections.ListConnections(ctx, ns)
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

	v := q.asConnection(ds, namespace)
	// TODO... access control?
	return &v, nil
}

func (q *connectionsProvider) ListConnections(ctx context.Context, namespace string) (*queryV0.DataSourceConnectionList, error) {
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID:           ns.OrgID,
		DataSourceLimit: 10000,
	})
	if err != nil {
		return nil, err
	}
	result := &queryV0.DataSourceConnectionList{
		Items: []queryV0.DataSourceConnection{},
	}
	for _, ds := range dss {
		result.Items = append(result.Items, q.asConnection(ds, namespace))
	}
	return result, nil
}

func (q *connectionsProvider) asConnection(ds *datasources.DataSource, ns string) queryV0.DataSourceConnection {
	gv, err := q.registry.GetDatasourceGroupVersion(ds.Type)
	if err != nil {
		// This happens for grafana-e2etest-datasource!
		gv = schema.GroupVersion{
			Group:   "",
			Version: "",
		}
	}
	if ds.APIVersion != "" {
		gv.Version = ds.APIVersion
	}

	v := queryV0.DataSourceConnection{
		ObjectMeta: metav1.ObjectMeta{
			Name:              queryV0.DataSourceConnectionName(gv.Group, ds.UID),
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Title: ds.Name,
		Datasource: queryV0.DataSourceConnectionRef{
			Group:   gv.Group,
			Version: gv.Version,
			Name:    ds.UID,
		},
	}
	v.UID = gapiutil.CalculateClusterWideUID(&v) // UID is unique across all groups
	if !ds.Updated.IsZero() {
		meta, err := utils.MetaAccessor(v)
		if err == nil {
			meta.SetUpdatedTimestamp(&ds.Updated)
		}
	}
	return v
}
