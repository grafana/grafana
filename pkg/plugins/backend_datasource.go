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
	client     *plugin.Client
}

type Killable interface {
	Kill()
}

type NoopKiller struct{}

func (nk NoopKiller) Kill() {}

func (p *BackendDatasource) initBackendPlugin() (Killable, error) {
	logger := log.New("grafana.plugins")

	p.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "BASIC_PLUGIN",
			MagicCookieValue: "hello",
		},
		Plugins:          map[string]plugin.Plugin{p.Id: &shared.TsdbPluginImpl{}},
		Cmd:              exec.Command("sh", "-c", path.Join(p.PluginDir, p.Executable)),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
		Logger:           backend.LogWrapper{Logger: logger},
	})

	rpcClient, err := p.client.Client()
	if err != nil {
		return NoopKiller{}, err
	}

	raw, err := rpcClient.Dispense(p.Id)
	if err != nil {
		return NoopKiller{}, err
	}

	plugin := raw.(shared.TsdbPlugin)
	response, err := plugin.Query(context.Background(), &proto.TsdbQuery{})

	if err != nil {
		logger.Error("Response from plugin. ", "response", response)
	} else {
		logger.Info("Response from plugin. ", "response", response)
	}

	tsdb.RegisterTsdbQueryEndpoint(p.Id, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return &shared.TsdbWrapper{TsdbPlugin: plugin}, nil
	})

	return p.client, nil
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
