package backendplugin

import (
	"os/exec"

	"github.com/grafana/grafana-plugin-sdk-go/backend/plugin"

	"github.com/grafana/grafana/pkg/infra/log"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	goplugin "github.com/hashicorp/go-plugin"
)

const (
	// DefaultProtocolVersion is the protocol version assumed for legacy clients that don't specify
	// a particular version or version 1 during their handshake. This is currently the version used
	// since Grafana launched support for backend plugins.
	DefaultProtocolVersion = 1
)

// Handshake is the HandshakeConfig used to configure clients and servers.
var handshake = goplugin.HandshakeConfig{
	// The ProtocolVersion is the version that must match between Grafana core
	// and Grafana plugins. This should be bumped whenever a (breaking) change
	// happens in one or the other that makes it so that they can't safely communicate.
	ProtocolVersion: DefaultProtocolVersion,

	// The magic cookie values should NEVER be changed.
	MagicCookieKey:   plugin.MagicCookieKey,
	MagicCookieValue: plugin.MagicCookieValue,
}

func newClientConfig(executablePath string, logger log.Logger, versionedPlugins map[int]goplugin.PluginSet) *goplugin.ClientConfig {
	return &goplugin.ClientConfig{
		Cmd:              exec.Command(executablePath),
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		Logger:           logWrapper{Logger: logger},
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
	}
}

// LegacyStartFunc callback function called when a plugin with old plugin protocol is started.
type LegacyStartFunc func(pluginID string, client *LegacyClient, logger log.Logger) error

// StartFunc callback function called when a plugin with current plugin protocol version is started.
type StartFunc func(pluginID string, client *Client, logger log.Logger) error

// PluginStartFuncs functions called for plugin when started.
type PluginStartFuncs struct {
	OnLegacyStart LegacyStartFunc
	OnStart       StartFunc
}

// PluginDescriptor descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	managed          bool
	versionedPlugins map[int]goplugin.PluginSet
	startFns         PluginStartFuncs
}

// NewBackendPluginDescriptor creates a new backend plugin descriptor
// used for registering a backend datasource plugin.
func NewBackendPluginDescriptor(pluginID, executablePath string, startFns PluginStartFuncs) PluginDescriptor {
	return PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        true,
		versionedPlugins: map[int]goplugin.PluginSet{
			DefaultProtocolVersion: {
				pluginID: &datasourceV1.DatasourcePluginImpl{},
			},
			plugin.ProtocolVersion: {
				"diagnostics": &plugin.DiagnosticsGRPCPlugin{},
				"resource":    &plugin.ResourceGRPCPlugin{},
				"data":        &plugin.DataGRPCPlugin{},
				"transform":   &plugin.TransformGRPCPlugin{},
			},
		},
		startFns: startFns,
	}
}

// NewRendererPluginDescriptor creates a new renderer plugin descriptor
// used for registering a backend renderer plugin.
func NewRendererPluginDescriptor(pluginID, executablePath string, startFns PluginStartFuncs) PluginDescriptor {
	return PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        false,
		versionedPlugins: map[int]goplugin.PluginSet{
			DefaultProtocolVersion: {
				pluginID: &rendererV1.RendererPluginImpl{},
			},
		},
		startFns: startFns,
	}
}

type DiagnosticsPlugin interface {
	plugin.DiagnosticsClient
}

type ResourcePlugin interface {
	plugin.ResourceClient
}

type DataPlugin interface {
	plugin.DataClient
}

type TransformPlugin interface {
	plugin.TransformClient
}

// LegacyClient client for communicating with a plugin using the old plugin protocol.
type LegacyClient struct {
	DatasourcePlugin datasourceV1.DatasourcePlugin
	RendererPlugin   rendererV1.RendererPlugin
}

// Client client for communicating with a plugin using the current plugin protocol.
type Client struct {
	ResourcePlugin  ResourcePlugin
	DataPlugin      DataPlugin
	TransformPlugin TransformPlugin
}
