package grpcplugin

import (
	"os/exec"
	"runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/hashicorp/go-plugin/runner"
	"github.com/hashicorp/go-secure-stdlib/plugincontainer"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/embedded"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
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

// pluginSet is list of plugins supported on v2.
var pluginSet = map[int]goplugin.PluginSet{
	grpcplugin.ProtocolVersion: {
		"diagnostics": &grpcplugin.DiagnosticsGRPCPlugin{},
		"resource":    &grpcplugin.ResourceGRPCPlugin{},
		"data":        &grpcplugin.DataGRPCPlugin{},
		"stream":      &grpcplugin.StreamGRPCPlugin{},
		"admission":   &grpcplugin.AdmissionGRPCPlugin{},
		"conversion":  &grpcplugin.ConversionGRPCPlugin{},
		"renderer":    &pluginextensionv2.RendererGRPCPlugin{},
	},
}

type clientTracerProvider struct {
	tracer trace.Tracer
	embedded.TracerProvider
}

func (ctp *clientTracerProvider) Tracer(_ string, _ ...trace.TracerOption) trace.Tracer {
	return ctp.tracer
}

func newClientTracerProvider(tracer trace.Tracer) trace.TracerProvider {
	return &clientTracerProvider{tracer: tracer}
}

func newClientConfig(descriptor PluginDescriptor, env []string, logger log.Logger, tracer trace.Tracer) *goplugin.ClientConfig {
	executablePath := descriptor.executablePath
	skipHostEnvVars := descriptor.skipHostEnvVars
	versionedPlugins := descriptor.versionedPlugins

	if runtime.GOOS == "linux" && descriptor.containerMode.enabled {
		return containerClientConfig(executablePath, descriptor.containerMode.image, logger, versionedPlugins, skipHostEnvVars, tracer)
	}

	logger.Info("Using process mode", "os", runtime.GOOS, "executablePath", executablePath)

	// We can ignore gosec G201 here, since the dynamic part of executablePath comes from the plugin definition
	// nolint:gosec
	cmd := exec.Command(executablePath, descriptor.executableArgs...)
	cmd.Env = env

	return &goplugin.ClientConfig{
		Cmd:              cmd,
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		SkipHostEnv:      skipHostEnvVars,
		Logger:           logWrapper{Logger: logger},
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
		GRPCDialOptions: []grpc.DialOption{
			// https://github.com/grafana/app-platform-wg/issues/140
			// external plugins are loaded before k8s API server
			// configures the tracing service thus failing to
			// record trace span in the middleware.
			// With code below we are passing the same tracer that k8s API server
			// uses so that middleware is configured with tracer.
			grpc.WithStatsHandler(otelgrpc.NewClientHandler(otelgrpc.WithTracerProvider(newClientTracerProvider(tracer)))),
		},
	}
}

func containerClientConfig(executablePath, containerImage string, logger log.Logger, versionedPlugins map[int]goplugin.PluginSet, skipHostEnvVars bool, tracer trace.Tracer) *goplugin.ClientConfig {
	logger.Debug("Linux host detected - using container mode", "executable", executablePath)
	return &goplugin.ClientConfig{
		RunnerFunc: func(l hclog.Logger, cmd *exec.Cmd, tmpDir string) (runner.Runner, error) {
			logger.Info("Creating container runner", "executablePath", executablePath, "tmpDir", tmpDir)
			config := &plugincontainer.Config{
				Image: containerImage,
				Env:   cmd.Env,
			}

			return config.NewContainerRunner(l, cmd, tmpDir)
		},
		HandshakeConfig:  handshake,
		VersionedPlugins: versionedPlugins,
		SkipHostEnv:      skipHostEnvVars,
		Logger:           logWrapper{Logger: logger},
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolGRPC},
		GRPCDialOptions: []grpc.DialOption{
			grpc.WithStatsHandler(otelgrpc.NewClientHandler(otelgrpc.WithTracerProvider(newClientTracerProvider(tracer)))),
		},
	}
}

// StartRendererFunc callback function called when a renderer plugin is started.
type StartRendererFunc func(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	executableArgs   []string
	skipHostEnvVars  bool
	managed          bool
	containerMode    containerModeOpts
	versionedPlugins map[int]goplugin.PluginSet
	startRendererFn  StartRendererFunc
}

type containerModeOpts struct {
	enabled bool
	image   string
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func NewBackendPlugin(pluginID, executablePath string, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newBackendPlugin(pluginID, executablePath, true, skipHostEnvVars, executableArgs...)
}

// NewUnmanagedBackendPlugin creates a new backend plugin factory used for registering an unmanaged backend plugin.
func NewUnmanagedBackendPlugin(pluginID, executablePath string, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newBackendPlugin(pluginID, executablePath, false, skipHostEnvVars, executableArgs...)
}

// NewBackendPlugin creates a new backend plugin factory used for registering a backend plugin.
func newBackendPlugin(pluginID, executablePath string, managed bool, skipHostEnvVars bool, executableArgs ...string) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:         pluginID,
		executablePath:   executablePath,
		executableArgs:   executableArgs,
		skipHostEnvVars:  skipHostEnvVars,
		managed:          managed,
		versionedPlugins: pluginSet,
	})
}

// NewRendererPlugin creates a new renderer plugin factory used for registering a backend renderer plugin.
func NewRendererPlugin(pluginID, executablePath string, startFn StartRendererFunc) backendplugin.PluginFactoryFunc {
	return newPlugin(PluginDescriptor{
		pluginID:         pluginID,
		executablePath:   executablePath,
		managed:          false,
		versionedPlugins: pluginSet,
		startRendererFn:  startFn,
	})
}
