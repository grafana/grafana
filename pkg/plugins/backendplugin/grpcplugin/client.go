package grpcplugin

import (
	"os/exec"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	goplugin "github.com/hashicorp/go-plugin"
)

// Handshake is the HandshakeConfig used to configure clients and servers.
var handshake = goplugin.HandshakeConfig{
	// The ProtocolVersion is the version that must match between Grafana core
	// and Grafana plugins. This should be bumped whenever a (breaking) change
	// happens in one or the other that makes it so that they can't safely communicate.
	ProtocolVersion: grpcplugin.ProtocolVersion,

	// The magic cookie values should NEVER be changed.
	MagicCookieKey:   grpcplugin.MagicCookieKey,
	MagicCookieValue: grpcplugin.MagicCookieValue,
}

func newClientConfig(executablePath string, env []string, logger log.Logger,
	versionedPlugins map[int]goplugin.PluginSet) *goplugin.ClientConfig {
	// We can ignore gosec G201 here, since the dynamic part of executablePath comes from the plugin definition
	// nolint:gosec
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

// StartFunc callback function called when a plugin with current plugin protocol version is started.
type StartFunc func(pluginID string, client *Client, logger log.Logger) error

// PluginStartFuncs functions called for plugin when started.
type PluginStartFuncs struct {
	OnStart StartFunc
}

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	managed          bool
	versionedPlugins map[int]goplugin.PluginSet
	startFns         PluginStartFuncs
}

// getV2PluginSet returns list of plugins supported on v2.
func getV2PluginSet() goplugin.PluginSet {
	return goplugin.PluginSet{
		"diagnostics": &grpcplugin.DiagnosticsGRPCPlugin{},
		"resource":    &grpcplugin.ResourceGRPCPlugin{},
		"data":        &grpcplugin.DataGRPCPlugin{},
		"stream":      &grpcplugin.StreamGRPCPlugin{},
		"renderer":    &pluginextensionv2.RendererGRPCPlugin{},
	}
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func NewBackendPlugin(pluginID, executablePath string, startFns PluginStartFuncs) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        true,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
		startFns: startFns,
	})
}

// NewRendererPlugin creates a new renderer plugin factory used for registering a backend renderer plugin.
func NewRendererPlugin(pluginID, executablePath string, startFns PluginStartFuncs) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        false,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
		startFns: startFns,
	})
}

// Client client for communicating with a plugin using the current (v2) plugin protocol.
type Client struct {
	DataPlugin     grpcplugin.DataClient
	RendererPlugin pluginextensionv2.RendererPlugin
	StreamClient   grpcplugin.StreamClient
}
