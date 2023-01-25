package grpcplugin

import (
	"os/exec"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	grpc_opentracing "github.com/grpc-ecosystem/go-grpc-middleware/tracing/opentracing"
	goplugin "github.com/hashicorp/go-plugin"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
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
		GRPCDialOptions: []grpc.DialOption{
			grpc.WithChainUnaryInterceptor(
				otelgrpc.UnaryClientInterceptor(),
				grpc_opentracing.UnaryClientInterceptor(),
			),
			grpc.WithChainStreamInterceptor(
				otelgrpc.StreamClientInterceptor(),
				grpc_opentracing.StreamClientInterceptor(),
			),
		},
	}
}

// StartRendererFunc callback function called when a renderer plugin is started.
type StartRendererFunc func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error

// StartSecretsManagerFunc callback function called when a secrets manager plugin is started.
type StartSecretsManagerFunc func(pluginID string, secretsmanager secretsmanagerplugin.SecretsManagerPlugin, logger log.Logger) error

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID              string
	executablePath        string
	managed               bool
	versionedPlugins      map[int]goplugin.PluginSet
	startRendererFn       StartRendererFunc
	startSecretsManagerFn StartSecretsManagerFunc
}

// getV2PluginSet returns list of plugins supported on v2.
func getV2PluginSet() goplugin.PluginSet {
	return goplugin.PluginSet{
		"diagnostics":    &grpcplugin.DiagnosticsGRPCPlugin{},
		"resource":       &grpcplugin.ResourceGRPCPlugin{},
		"data":           &grpcplugin.DataGRPCPlugin{},
		"stream":         &grpcplugin.StreamGRPCPlugin{},
		"renderer":       &pluginextensionv2.RendererGRPCPlugin{},
		"secretsmanager": &secretsmanagerplugin.SecretsManagerGRPCPlugin{},
	}
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func NewBackendPlugin(pluginID, executablePath string) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        true,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
	})
}

// NewRendererPlugin creates a new renderer plugin factory used for registering a backend renderer plugin.
func NewRendererPlugin(pluginID, executablePath string, startFn StartRendererFunc) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        false,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
		startRendererFn: startFn,
	})
}

// NewSecetsManagerPlugin creates a new secrets manager plugin factory used for registering a backend secrets manager plugin.
func NewSecretsManagerPlugin(pluginID, executablePath string, startFn StartSecretsManagerFunc) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:       pluginID,
		executablePath: executablePath,
		managed:        false,
		versionedPlugins: map[int]goplugin.PluginSet{
			grpcplugin.ProtocolVersion: getV2PluginSet(),
		},
		startSecretsManagerFn: startFn,
	})
}
