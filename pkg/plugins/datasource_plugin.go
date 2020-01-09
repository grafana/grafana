package plugins

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	sdk "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/datasource/wrapper"
	"github.com/grafana/grafana/pkg/tsdb"
	plugin "github.com/hashicorp/go-plugin"
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
	QueryOptions map[string]bool   `json:"queryOptions,omitempty"`
	BuiltIn      bool              `json:"builtIn,omitempty"`
	Mixed        bool              `json:"mixed,omitempty"`
	Routes       []*AppPluginRoute `json:"routes"`
	Streaming    bool              `json:"streaming"`

	Backend    bool   `json:"backend,omitempty"`
	Executable string `json:"executable,omitempty"`
	SDK        bool   `json:"sdk,omitempty"`
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(p); err != nil {
		return errutil.Wrapf(err, "Failed to decode datasource plugin")
	}

	if !p.isVersionOne() && !setting.IsExpressionsEnabled() {
		return errors.New("A plugin version 2 was found, but expressions feature toggle is not enabled")
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return errutil.Wrapf(err, "Failed to register plugin")
	}

	if p.Backend {
		cmd := ComposePluginStartCommmand(p.Executable)
		fullpath := path.Join(p.PluginDir, cmd)
		descriptor := backendplugin.NewBackendPluginDescriptor(p.Id, fullpath)
		if err := backendplugin.Register(descriptor, p.onPluginStart); err != nil {
			return errutil.Wrapf(err, "Failed to register backend plugin")
		}
	}

	DataSources[p.Id] = p
	return nil
}

func (p *DataSourcePlugin) isVersionOne() bool {
	return !p.SDK
}

func (p *DataSourcePlugin) onPluginStart(pluginID string, client *plugin.Client, logger log.Logger) error {
	rpcClient, err := client.Client()
	if err != nil {
		return err
	}

	if client.NegotiatedVersion() == 1 {
		raw, err := rpcClient.Dispense(pluginID)
		if err != nil {
			return err
		}
		plugin := raw.(datasourceV1.DatasourcePlugin)

		tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
			return wrapper.NewDatasourcePluginWrapper(logger, plugin), nil
		})
		return nil
	}

	raw, err := rpcClient.Dispense("backend")
	if err != nil {
		return err
	}
	plugin, ok := raw.(sdk.BackendPlugin)
	if !ok {
		return fmt.Errorf("unexpected type %T, expected sdk.Plugin", raw)
	}

	tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return wrapper.NewDatasourcePluginWrapperV2(logger, plugin), nil
	})

	return nil
}
