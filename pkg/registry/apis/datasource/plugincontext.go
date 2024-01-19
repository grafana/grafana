package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// This provides access to settings saved in the database.
// Authorization checks will happen within each function, and the user in ctx will
// limit which namespace/tenant/org we are talking to
type PluginConfigProvider interface {
	// Datasource gets all data source plugins (with elevated permissions).
	GetDataSource(ctx context.Context, pluginID, uid string) (*v0alpha1.DataSourceConnection, error)

	// Datasources lists all data sources (with elevated permissions).
	ListDatasources(ctx context.Context, pluginID string) (*v0alpha1.DataSourceConnectionList, error)

	// Return settings (decrypted!) for a specific plugin
	// This will require "query" permission for the user in context
	PluginContextForDataSource(ctx context.Context, pluginID, uid string) (backend.PluginContext, error)
}

type defaultPluginConfigProvider struct {
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	contextProvider *plugincontext.Provider
}

var (
	_ PluginConfigProvider = (*defaultPluginConfigProvider)(nil)
)

func (q *defaultPluginConfigProvider) GetDataSource(ctx context.Context, pluginID, uid string) (*v0alpha1.DataSourceConnection, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return asConnection(ds, info.Value)
}

func (q *defaultPluginConfigProvider) ListDatasources(ctx context.Context, pluginID string) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	ds, err := q.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID: info.OrgID,
		Type:  pluginID,
	})
	if err != nil {
		return nil, err
	}
	return asConnectionList(ds, info.Value)
}

func (q *defaultPluginConfigProvider) PluginContextForDataSource(ctx context.Context, pluginID, uid string) (backend.PluginContext, error) {
	return q.contextProvider.PluginContextForDataSource(ctx, pluginID, uid)
}

func asConnection(ds *datasources.DataSource, ns string) (*v0alpha1.DataSourceConnection, error) {
	v := &v0alpha1.DataSourceConnection{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
		},
		Title: ds.Name,
	}
	v.UID = utils.CalculateClusterWideUID(v) // indicates if the value changed on the server
	meta, err := utils.MetaAccessor(v)
	if err != nil {
		meta.SetUpdatedTimestamp(&ds.Updated)
	}
	return v, err
}

func asConnectionList(dss []*datasources.DataSource, ns string) (*v0alpha1.DataSourceConnectionList, error) {
	result := &v0alpha1.DataSourceConnectionList{
		Items: []v0alpha1.DataSourceConnection{},
	}
	for _, ds := range dss {
		v, _ := asConnection(ds, ns)
		result.Items = append(result.Items, *v)
	}

	return result, nil
}
