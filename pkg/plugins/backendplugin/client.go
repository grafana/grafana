package backendplugin

import (
	"os/exec"

	"github.com/grafana/grafana/pkg/infra/log"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	sdk "github.com/grafana/grafana-plugin-sdk-go/common"
	datasourceV2 "github.com/grafana/grafana-plugin-sdk-go/datasource"
	transformV2 "github.com/grafana/grafana-plugin-sdk-go/transform"
	"github.com/hashicorp/go-plugin"
)

const (
	// DefaultProtocolVersion is the protocol version assumed for legacy clients that don't specify
	// a particular version or version 1 during their handshake. This is currently the version used
	// since Grafana launched support for backend plugins.
	DefaultProtocolVersion = 1
)

// Handshake is the HandshakeConfig used to configure clients and servers.
var handshake = plugin.HandshakeConfig{
	// The ProtocolVersion is the version that must match between Grafana core
	// and Grafana plugins. This should be bumped whenever a (breaking) change
	// happens in one or the other that makes it so that they can't safely communicate.
	ProtocolVersion: DefaultProtocolVersion,

	// The magic cookie values should NEVER be changed.
	MagicCookieKey:   sdk.MagicCookieKey,
	MagicCookieValue: sdk.MagicCookieValue,
}

// NewClientConfig returns a configuration object that can be used to instantiate
// a client for the plugin described by the given metadata.
func NewClientConfig(executablePath string, logger log.Logger, versionedPlugins map[int]plugin.PluginSet) *plugin.ClientConfig {
	return &plugin.ClientConfig{
		Cmd:              exec.Command(executablePath),
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		Logger:           logWrapper{Logger: logger},
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
	}
}

// NewDatasourceClient returns a datasource plugin client.
func NewDatasourceClient(pluginID, executablePath string, logger log.Logger) *plugin.Client {
	versionedPlugins := map[int]plugin.PluginSet{
		1: {
			pluginID: &datasourceV1.DatasourcePluginImpl{},
		},
		2: {
			pluginID: &datasourceV2.DatasourcePluginImpl{},
		},
	}

	return plugin.NewClient(NewClientConfig(executablePath, logger, versionedPlugins))
}

// NewRendererClient returns a renderer plugin client.
func NewRendererClient(pluginID, executablePath string, logger log.Logger) *plugin.Client {
	versionedPlugins := map[int]plugin.PluginSet{
		1: {
			pluginID: &rendererV1.RendererPluginImpl{},
		},
	}

	return plugin.NewClient(NewClientConfig(executablePath, logger, versionedPlugins))
}

// NewTransformClient returns a transform plugin client.
func NewTransformClient(pluginID, executablePath string, logger log.Logger) *plugin.Client {
	versionedPlugins := map[int]plugin.PluginSet{
		2: {
			pluginID: &transformV2.TransformPluginImpl{},
		},
	}

	return plugin.NewClient(NewClientConfig(executablePath, logger, versionedPlugins))
}
