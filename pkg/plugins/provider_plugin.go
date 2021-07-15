package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// ProviderPlugin contains all metadata about a provider plugin
type ProviderPlugin struct {
	FrontendPluginBase
	Executable map[string]string `json:"executable"`
}

func (p *ProviderPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) (
	interface{}, error) {
	if err := decoder.Decode(p); err != nil {
		return nil, errutil.Wrapf(err, "Failed to decode datasource plugin")
	}

	// allows combination of GOOS/GOARCH, */GOARCH, GOOS/*, *, examples:
	// linux/amd64: provider-linux-amd64
	// linux/*: provider-linux
	// */amd64: provider-amd64
	// windows/*: provider-windows.exe
	// *: provider
	os := runtime.GOOS
	arch := runtime.GOARCH
	osArch := fmt.Sprintf("%s/%s", os, arch)
	executable := ""
	if e, exists := p.Executable[osArch]; exists {
		executable = e
	} else if e, exists := p.Executable[fmt.Sprintf("%s/*", os)]; exists {
		executable = e
	} else if e, exists := p.Executable[fmt.Sprintf("*/%s", arch)]; exists {
		executable = e
	} else if e, exists := p.Executable["*"]; exists {
		executable = e
	}

	cmd := ComposePluginStartCommand(executable)
	fullpath := filepath.Join(base.PluginDir, cmd)
	factory := grpcplugin.NewProviderPlugin(p.Id, fullpath)
	if err := backendPluginManager.RegisterAndStart(context.Background(), p.Id, factory); err != nil {
		return nil, errutil.Wrapf(err, "failed to register backend plugin")
	}

	return p, nil
}
