package backendplugin

import (
	"context"
	"errors"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	backend "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	plugin "github.com/hashicorp/go-plugin"
)

// BackendPlugin a registered backend plugin.
type BackendPlugin struct {
	id             string
	executablePath string
	managed        bool
	clientFactory  func() *plugin.Client
	client         *plugin.Client
	logger         log.Logger
	startFns       PluginStartFuncs
}

func (p *BackendPlugin) start(ctx context.Context) error {
	p.client = p.clientFactory()
	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	var legacyClient *LegacyClient
	var client *Client

	if p.client.NegotiatedVersion() > 1 {
		rawBackend, err := rpcClient.Dispense("backend")
		if err != nil {
			return err
		}

		rawTransform, err := rpcClient.Dispense("transform")
		if err != nil {
			return err
		}

		client = &Client{}
		if rawBackend != nil {
			if plugin, ok := rawBackend.(backend.BackendPlugin); ok {
				client.BackendPlugin = plugin
			}
		}

		if rawTransform != nil {
			if plugin, ok := rawTransform.(backend.TransformPlugin); ok {
				client.TransformPlugin = plugin
			}
		}
	} else {
		raw, err := rpcClient.Dispense(p.id)
		if err != nil {
			return err
		}

		legacyClient = &LegacyClient{}
		if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
			legacyClient.DatasourcePlugin = plugin
		}

		if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
			legacyClient.RendererPlugin = plugin
		}
	}

	if legacyClient == nil && client == nil {
		return errors.New("no compatible plugin implementation found")
	}

	if legacyClient != nil && p.startFns.OnLegacyStart != nil {
		if err := p.startFns.OnLegacyStart(p.id, legacyClient, p.logger); err != nil {
			return err
		}
	}

	if client != nil && p.startFns.OnStart != nil {
		if err := p.startFns.OnStart(p.id, client, p.logger); err != nil {
			return err
		}
	}

	return nil
}

func (p *BackendPlugin) stop() error {
	if p.client != nil {
		p.client.Kill()
	}
	return nil
}
