package grpcplugin

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"

	"github.com/hashicorp/go-hclog"
	goplugin "github.com/hashicorp/go-plugin"
	"github.com/hashicorp/go-plugin/runner"
	"github.com/hashicorp/go-secure-stdlib/plugincontainer"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/embedded"
	"google.golang.org/grpc"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
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

// illegalArgChars matches shell metacharacters that should never appear in
// plugin executable arguments. Because exec.Command does not invoke a shell,
// these characters are not inherently dangerous at the OS level, but their
// presence almost certainly indicates a misconfiguration or injection attempt.
var illegalArgChars = regexp.MustCompile(`[;&|` + "`" + `$<>(){}]`)

// validateExecArgs returns an error if any argument contains characters that
// could be interpreted as shell metacharacters.
func validateExecArgs(args []string) error {
	for _, arg := range args {
		if illegalArgChars.MatchString(arg) {
			return errors.New("plugin executable argument contains invalid characters")
		}
	}
	return nil
}

func newClientConfig(descriptor PluginDescriptor, env []string, logger log.Logger, tracer trace.Tracer) (*goplugin.ClientConfig, error) {
	executablePath := descriptor.executablePath
	skipHostEnvVars := descriptor.skipHostEnvVars
	versionedPlugins := descriptor.versionedPlugins

	if runtime.GOOS == "linux" && descriptor.containerMode.enabled {
		return containerClientConfig(executablePath, descriptor.containerMode.image, descriptor.containerMode.tag, logger, versionedPlugins, skipHostEnvVars, tracer), nil
	}
	cfg := &goplugin.ClientConfig{
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

	if descriptor.runnerFunc != nil {
		cfg.RunnerFunc = descriptor.runnerFunc
		td, err := os.MkdirTemp("", "plugin")
		if err != nil {
			return nil, err
		}
		cfg.UnixSocketConfig = &goplugin.UnixSocketConfig{TempDir: td}
		logger.Debug("Using runner mode", "os", runtime.GOOS, "executablePath", executablePath)
	} else {
		logger.Debug("Using process mode", "os", runtime.GOOS, "executablePath", executablePath)
		// filepath.Clean removes any path traversal sequences before the path is used in exec.Command.
		// We additionally require the path to be absolute to prevent ambiguous or injected relative paths.
		cleanPath := filepath.Clean(executablePath)
		if !filepath.IsAbs(cleanPath) {
			return nil, errors.New("plugin executable path must be an absolute path")
		}
		if err := validateExecArgs(descriptor.executableArgs); err != nil {
			return nil, err
		}
		// executablePath has been cleaned and verified to be an absolute path above.
		// executableArgs have been validated to contain no shell metacharacters.
		// exec.Command does not invoke a shell, so arguments are passed directly
		// to the OS without further interpretation, preventing command injection.
		cfg.Cmd = exec.Command(cleanPath, descriptor.executableArgs...) //nolint:gosec // nosemgrep: dangerous-exec-command
		cfg.Cmd.Env = env
	}

	return cfg, nil
}

func containerClientConfig(executablePath, containerImage, containerTag string, logger log.Logger, versionedPlugins map[int]goplugin.PluginSet, skipHostEnvVars bool, tracer trace.Tracer) *goplugin.ClientConfig {
	logger.Info("Using container mode", "executable", executablePath, "image", containerImage, "tag", containerTag)
	return &goplugin.ClientConfig{
		RunnerFunc: func(l hclog.Logger, cmd *exec.Cmd, tmpDir string) (runner.Runner, error) {
			logger.Info("Creating container runner", "executablePath", executablePath, "tmpDir", tmpDir)
			config := &plugincontainer.Config{
				Image: containerImage,
				Tag:   containerTag,
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

// PluginDescriptor is a descriptor used for registering backend plugins.
type PluginDescriptor struct {
	pluginID         string
	executablePath   string
	executableArgs   []string
	skipHostEnvVars  bool
	managed          bool
	containerMode    containerModeOpts
	runnerFunc       func(l hclog.Logger, cmd *exec.Cmd, tmpDir string) (runner.Runner, error)
	versionedPlugins map[int]goplugin.PluginSet
}

type containerModeOpts struct {
	enabled bool
	image   string
	tag     string
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
