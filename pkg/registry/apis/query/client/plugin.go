package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

type pluginClient struct {
	pluginClient plugins.Client
	pCtxProvider *plugincontext.Provider
}

type pluginRegistry struct {
	pluginsMu     sync.Mutex
	plugins       *query.DataSourceApiServerList
	apis          map[string]schema.GroupVersion
	groupToPlugin map[string]string
	pluginStore   pluginstore.Store

	// called on demand
	dataSourcesService datasources.DataSourceService
}

var _ clientapi.QueryDataClient = (*pluginClient)(nil)
var _ query.DataSourceApiServerRegistry = (*pluginRegistry)(nil)

// NewQueryClientForPluginClient creates a client that delegates to the internal plugins.Client stack
func NewQueryClientForPluginClient(p plugins.Client, ctx *plugincontext.Provider) clientapi.QueryDataClient {
	return &pluginClient{
		pluginClient: p,
		pCtxProvider: ctx,
	}
}

func NewDataSourceRegistryFromStore(pluginStore pluginstore.Store,
	dataSourcesService datasources.DataSourceService,
) query.DataSourceApiServerRegistry {
	return &pluginRegistry{
		pluginStore:        pluginStore,
		dataSourcesService: dataSourcesService,
	}
}

// ExecuteQueryData implements QueryHelper.
func (d *pluginClient) QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error) {
	queries, dsRef, err := data.ToDataSourceQueries(req)
	if err != nil {
		return nil, err
	}
	if dsRef == nil {
		return nil, fmt.Errorf("expected single datasource request")
	}

	// NOTE: this depends on uid unique across datasources
	settings, err := d.pCtxProvider.GetDataSourceInstanceSettings(ctx, dsRef.UID)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			status := metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusNotFound,
				Message: "datasource not found",
			}
			return nil, &apierrors.StatusError{ErrStatus: status}
		}
		return nil, err
	}

	qdr := &backend.QueryDataRequest{
		Queries: queries,
	}
	qdr.PluginContext, err = d.pCtxProvider.PluginContextForDataSource(ctx, settings)
	if err != nil {
		return nil, err
	}

	rsp, err := d.pluginClient.QueryData(ctx, qdr)
	if err != nil {
		return rsp, err
	}
	return rsp, err
}

// GetDatasourceAPI implements DataSourceRegistry.
func (d *pluginRegistry) GetDatasourceGroupVersion(pluginId string) (schema.GroupVersion, error) {
	d.pluginsMu.Lock()
	defer d.pluginsMu.Unlock()

	if d.plugins == nil {
		err := d.updatePlugins()
		if err != nil {
			return schema.GroupVersion{}, err
		}
	}

	var err error
	gv, ok := d.apis[pluginId]
	if !ok {
		err = fmt.Errorf("no API found for id: %s", pluginId)
	}
	return gv, err
}

// GetDatasourcePlugins no namespace? everything that is available
func (d *pluginRegistry) GetDatasourceApiServers(ctx context.Context) (*query.DataSourceApiServerList, error) {
	d.pluginsMu.Lock()
	defer d.pluginsMu.Unlock()

	if d.plugins == nil {
		err := d.updatePlugins()
		if err != nil {
			return nil, err
		}
	}

	return d.plugins, nil
}

// This should be called when plugins change
func (d *pluginRegistry) updatePlugins() error {
	groupToPlugin := map[string]string{}
	apis := map[string]schema.GroupVersion{}
	result := &query.DataSourceApiServerList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: fmt.Sprintf("%d", time.Now().UnixMilli()),
		},
	}

	// TODO? only backend plugins
	for _, dsp := range d.pluginStore.Plugins(context.Background(), plugins.TypeDataSource) {
		ts := setting.BuildStamp * 1000
		if dsp.Info.Build.Time > 0 {
			ts = dsp.Info.Build.Time
		}

		group, err := plugins.GetDatasourceGroupNameFromPluginID(dsp.ID)
		if err != nil {
			return err
		}
		gv := schema.GroupVersion{Group: group, Version: "v0alpha1"} // default version
		apis[dsp.ID] = gv
		for _, alias := range dsp.AliasIDs {
			apis[alias] = gv
		}
		groupToPlugin[group] = dsp.ID

		ds := query.DataSourceApiServer{
			ObjectMeta: metav1.ObjectMeta{
				Name:              dsp.ID,
				CreationTimestamp: metav1.NewTime(time.UnixMilli(ts)),
			},
			Title:        dsp.Name,
			AliasIDs:     dsp.AliasIDs,
			GroupVersion: gv.String(),
			Description:  dsp.Info.Description,
		}
		result.Items = append(result.Items, ds)
	}

	d.plugins = result
	d.apis = apis
	d.groupToPlugin = groupToPlugin
	return nil
}
