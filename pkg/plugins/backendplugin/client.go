package backendplugin

import (
	"os/exec"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
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
	MagicCookieKey:   grpcplugin.MagicCookieKey,
	MagicCookieValue: grpcplugin.MagicCookieValue,
}

func newClientConfig(executablePath string, env []string, logger log.Logger, versionedPlugins map[int]goplugin.PluginSet) *goplugin.ClientConfig {
	cmd := exec.Command(executablePath)
	cmd.Env = env

	return &goplugin.ClientConfig{
		Cmd:              cmd,
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

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	managed          bool
	versionedPlugins map[int]goplugin.PluginSet
	startFns         PluginStartFuncs
}

// PluginID returns the plugin ID.
func (pd PluginDescriptor) PluginID() string {
	return pd.pluginID
}

// getV2PluginSet returns list of plugins supported on v2.
func getV2PluginSet() goplugin.PluginSet {
	return goplugin.PluginSet{
		"diagnostics": &grpcplugin.DiagnosticsGRPCPlugin{},
		"resource":    &grpcplugin.ResourceGRPCPlugin{},
		"data":        &grpcplugin.DataGRPCPlugin{},
		"transform":   &grpcplugin.TransformGRPCPlugin{},
		"renderer":    &pluginextensionv2.RendererGRPCPlugin{},
	}
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
			grpcplugin.ProtocolVersion: getV2PluginSet(),
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
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
		startFns: startFns,
	}
}

type DiagnosticsPlugin interface {
	grpcplugin.DiagnosticsClient
}

type ResourcePlugin interface {
	grpcplugin.ResourceClient
}

type DataPlugin interface {
	grpcplugin.DataClient
}

type TransformPlugin interface {
	grpcplugin.TransformClient
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
	RendererPlugin  pluginextensionv2.RendererPlugin
}
