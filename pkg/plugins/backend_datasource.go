package plugins

import (
	"context"
	"encoding/json"
	"os/exec"
	"path"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backend"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/grafana/grafana/pkg/log"
	proto "github.com/grafana/grafana/pkg/tsdb/models"
	shared "github.com/grafana/grafana/pkg/tsdb/models/proxy"
	plugin "github.com/hashicorp/go-plugin"
)

type BackendDatasource struct {
	*PluginBase

	Executable string
	log        log.Logger
	client     *plugin.Client
}

func (p *BackendDatasource) initBackendPlugin(log log.Logger) error {
	p.log = log.New("plugin-id", p.Id)

	p.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "BASIC_PLUGIN",
			MagicCookieValue: "hello",
		},
		Plugins:          map[string]plugin.Plugin{p.Id: &shared.TsdbPluginImpl{}},
		Cmd:              exec.Command("sh", "-c", path.Join(p.PluginDir, p.Executable)),
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
	response, err := plugin.Query(context.Background(), &proto.TsdbQuery{})

	if err != nil {
		p.log.Error("Response from plugin. ", "response", response)
	} else {
		p.log.Info("Response from plugin. ", "response", response)
	}

	tsdb.RegisterTsdbQueryEndpoint(p.Id, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return &shared.TsdbWrapper{TsdbPlugin: plugin}, nil
	})

	return nil
}

func (p *BackendDatasource) Kill() {
	p.client.Kill()
}

func (p *BackendDatasource) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	BackendDatasources[p.Id] = p
	return nil
}
