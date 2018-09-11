package plugins

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"time"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	"github.com/grafana/grafana/pkg/log"
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
	Logs         bool              `json:"logs"`
	QueryOptions map[string]bool   `json:"queryOptions,omitempty"`
	BuiltIn      bool              `json:"builtIn,omitempty"`
	Mixed        bool              `json:"mixed,omitempty"`
	HasQueryHelp bool              `json:"hasQueryHelp,omitempty"`
	Routes       []*AppPluginRoute `json:"routes"`

	Backend    bool   `json:"backend,omitempty"`
	Executable string `json:"executable,omitempty"`

	log    log.Logger
	client *plugin.Client
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	// look for help markdown
	helpPath := filepath.Join(p.PluginDir, "QUERY_HELP.md")
	if _, err := os.Stat(helpPath); os.IsNotExist(err) {
		helpPath = filepath.Join(p.PluginDir, "query_help.md")
	}
	if _, err := os.Stat(helpPath); err == nil {
		p.HasQueryHelp = true
	}

	DataSources[p.Id] = p
	return nil
}

var handshakeConfig = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "grafana_plugin_type",
	MagicCookieValue: "datasource",
}

func (p *DataSourcePlugin) startBackendPlugin(ctx context.Context, log log.Logger) error {
	p.log = log.New("plugin-id", p.Id)

	err := p.spawnSubProcess()
	if err == nil {
		go p.restartKilledProcess(ctx)
	}

	return err
}

func (p *DataSourcePlugin) spawnSubProcess() error {
	cmd := ComposePluginStartCommmand(p.Executable)
	fullpath := path.Join(p.PluginDir, cmd)

	p.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig:  handshakeConfig,
		Plugins:          map[string]plugin.Plugin{p.Id: &datasource.DatasourcePluginImpl{}},
		Cmd:              exec.Command(fullpath),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
		Logger:           LogWrapper{Logger: p.log},
	})

	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	raw, err := rpcClient.Dispense(p.Id)
	if err != nil {
		return err
	}

	plugin := raw.(datasource.DatasourcePlugin)

	tsdb.RegisterTsdbQueryEndpoint(p.Id, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return wrapper.NewDatasourcePluginWrapper(p.log, plugin), nil
	})

	return nil
}

func (p *DataSourcePlugin) restartKilledProcess(ctx context.Context) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if p.client.Exited() {
				err := p.spawnSubProcess()
				p.log.Debug("Spawning new sub process", "name", p.Name, "id", p.Id)
				if err != nil {
					p.log.Error("Failed to spawn subprocess")
				}
			}
		}
	}
}

func (p *DataSourcePlugin) Kill() {
	if p.client != nil {
		p.log.Debug("Killing subprocess ", "name", p.Name)
		p.client.Kill()
	}
}
