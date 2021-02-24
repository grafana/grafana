package models

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	backendmodels "github.com/grafana/grafana/pkg/plugins/backendplugin/models"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// DataSourcePlugin contains all metadata about a datasource plugin
type DataSourcePlugin struct {
	FrontendPluginBase
	Annotations  bool              `json:"annotations"`
	Metrics      bool              `json:"metrics"`
	Alerting     bool              `json:"alerting"`
	Explore      bool              `json:"explore"`
	Table        bool              `json:"tables"`
	Logs         bool              `json:"logs"`
	Tracing      bool              `json:"tracing"`
	QueryOptions map[string]bool   `json:"queryOptions,omitempty"`
	BuiltIn      bool              `json:"builtIn,omitempty"`
	Mixed        bool              `json:"mixed,omitempty"`
	Routes       []*AppPluginRoute `json:"routes"`
	Streaming    bool              `json:"streaming"`

	Backend    bool   `json:"backend,omitempty"`
	Executable string `json:"executable,omitempty"`
	SDK        bool   `json:"sdk,omitempty"`

	client       *grpcplugin.Client
	legacyClient *grpcplugin.LegacyClient
	logger       log.Logger
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendmodels.Manager) (
	interface{}, error) {
	if err := decoder.Decode(p); err != nil {
		return nil, errutil.Wrapf(err, "Failed to decode datasource plugin")
	}

	if p.Backend {
		cmd := ComposePluginStartCommand(p.Executable)
		fullpath := filepath.Join(p.PluginDir, cmd)
		factory := grpcplugin.NewBackendPlugin(p.Id, fullpath, grpcplugin.PluginStartFuncs{
			OnLegacyStart: p.onLegacyPluginStart,
			OnStart:       p.onPluginStart,
		})
		if err := backendPluginManager.Register(p.Id, factory); err != nil {
			return nil, errutil.Wrapf(err, "failed to register backend plugin")
		}
	}

	return p, nil
}

func (p *DataSourcePlugin) DataQuery(ctx context.Context, dsInfo *models.DataSource, query DataQuery) (DataResponse, error) {
	if p.client != nil {
		endpoint := newDataSourcePluginWrapperV2(p.logger, p.Id, p.Type, p.client.DataPlugin)
		return endpoint.Query(ctx, dsInfo, query)
	}
	if p.legacyClient != nil {
		endpoint := newDataSourcePluginWrapper(p.logger, p.legacyClient.DatasourcePlugin)
		return endpoint.Query(ctx, dsInfo, query)
	}

	return DataResponse{}, fmt.Errorf("plugin %q doesn't support TSDB queries", p.Id)
}

func (p *DataSourcePlugin) onLegacyPluginStart(pluginID string, client *grpcplugin.LegacyClient, logger log.Logger) error {
	p.legacyClient = client
	p.logger = logger
	// TODO
	/*
		tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
			return wrapper.NewDatasourcePluginWrapper(logger, client.DatasourcePlugin), nil
		})
	*/

	return nil
}

func (p *DataSourcePlugin) onPluginStart(pluginID string, client *grpcplugin.Client, logger log.Logger) error {
	if client.DataPlugin == nil {
		return nil
	}

	p.client = client
	p.logger = logger
	// TODO
	/*
		if client.DataPlugin != nil {
			tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
				return wrapper.NewDatasourcePluginWrapperV2(logger, p.Id, p.Type, client.DataPlugin), nil
			})
		}
	*/

	return nil
}
