package plugins

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backend"
	"github.com/grafana/grafana/pkg/tsdb"
	shared "github.com/grafana/grafana/pkg/tsdb/models/proxy"
	plugin "github.com/hashicorp/go-plugin"
)

type DataSourcePlugin struct {
	FrontendPluginBase
	Annotations  bool              `json:"annotations"`
	Metrics      bool              `json:"metrics"`
	Alerting     bool              `json:"alerting"`
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
	MagicCookieKey:   "GRAFANA_BACKEND_DATASOURCE",
	MagicCookieValue: "55d2200a-6492-493a-9353-73b728d468aa",
}

func buildExecutablePath(pluginDir, executable, os, arch string) string {
	return path.Join(pluginDir, fmt.Sprintf("%s_%s_%s", executable, strings.ToLower(os), strings.ToLower(arch)))
}

func (p *DataSourcePlugin) initBackendPlugin(log log.Logger) error {
	p.log = log.New("plugin-id", p.Id)

	p.spawnSubProcess()
	go p.reattachKilledProcess()

	return nil
}

func (p *DataSourcePlugin) spawnSubProcess() error {
	cmd := buildExecutablePath(p.PluginDir, p.Executable, runtime.GOOS, runtime.GOARCH)

	p.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig:  handshakeConfig,
		Plugins:          map[string]plugin.Plugin{p.Id: &shared.TsdbPluginImpl{}},
		Cmd:              exec.Command(cmd),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
		Logger:           backend.LogWrapper{Logger: p.log},
	})

	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	raw, err := rpcClient.Dispense(p.Id)
	if err != nil {
		return err
	}

	plugin := raw.(shared.TsdbPlugin)

	tsdb.RegisterTsdbQueryEndpoint(p.Id, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return &shared.DatasourcePluginWrapper{TsdbPlugin: plugin}, nil
	})

	return nil
}

func (p *DataSourcePlugin) reattachKilledProcess() {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ticker.C:
			if p.client.Exited() {
				err := p.spawnSubProcess()
				if err != nil {
					p.log.Error("Failed to spawn subprocess")
				}
			}
		}
	}
}

func (p *DataSourcePlugin) Kill() {
	if p.client != nil {
		p.client.Kill()
	}
}
