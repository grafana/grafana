package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/transform"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/xerrors"
)

type TransformPlugin struct {
	PluginBase
	// TODO we probably want a Backend Plugin Base? Or some way to dedup proc management code

	Executable string `json:"executable,omitempty"`

	client *plugin.Client
	log    log.Logger
}

func (tp *TransformPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&tp); err != nil {
		return err
	}

	if err := tp.registerPlugin(pluginDir); err != nil {
		return err
	}

	Transform = tp
	return nil
}

func (p *TransformPlugin) startBackendPlugin(ctx context.Context, log log.Logger) error {
	p.log = log.New("plugin-id", p.Id)

	if err := p.spawnSubProcess(); err != nil {
		return err
	}

	go func() {
		if err := p.restartKilledProcess(ctx); err != nil {
			p.log.Error("Attempting to restart killed process failed", "err", err)
		}
	}()

	return nil
}

func (p *TransformPlugin) spawnSubProcess() error {
	cmd := ComposePluginStartCommmand(p.Executable)
	fullpath := path.Join(p.PluginDir, cmd)

	p.client = backendplugin.NewTransformClient(p.Id, fullpath, p.log)

	rpcClient, err := p.client.Client()
	if err != nil {
		return err
	}

	raw, err := rpcClient.Dispense(p.Id)
	if err != nil {
		return err
	}

	plugin, ok := raw.(transform.TransformPlugin)
	if !ok {
		return fmt.Errorf("unxpected type %T, expeced sdk.DatasourcePlugin", raw)
	}

	_ = plugin

	return nil
}

func (p *TransformPlugin) restartKilledProcess(ctx context.Context) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil && !xerrors.Is(err, context.Canceled) {
				return err
			}
			return nil
		case <-ticker.C:
			if !p.client.Exited() {
				continue
			}

			if err := p.spawnSubProcess(); err != nil {
				p.log.Error("Failed to restart plugin", "err", err)
				continue
			}

			p.log.Debug("Plugin process restarted")
		}
	}
}

func (p *TransformPlugin) Kill() {
	if p.client != nil {
		p.log.Debug("Killing subprocess ", "name", p.Name)
		p.client.Kill()
	}
}
