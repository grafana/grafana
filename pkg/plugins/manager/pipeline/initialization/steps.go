package initialization

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel/trace"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// BackendClientInit implements an InitializeFunc for initializing a backend plugin process.
//
// It uses the envvars.Provider to retrieve the environment variables required for the plugin and the plugins.BackendFactoryProvider
// to get fetch backend factory, which is used to form a connection to the backend plugin process.
//
// Note: This step does not start the backend plugin process. Please see BackendClientStarter for starting the backend plugin process.
type BackendClientInit struct {
	envVarProvider  envvars.Provider
	backendProvider plugins.BackendFactoryProvider
	log             log.Logger
	tracer          trace.Tracer
}

// BackendClientInitStep returns a new InitializeFunc for registering a backend plugin process.
func BackendClientInitStep(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider, tracer trace.Tracer) InitializeFunc {
	return newBackendProcessRegistration(envVarProvider, backendProvider, tracer).Initialize
}

func newBackendProcessRegistration(envVarProvider envvars.Provider,
	backendProvider plugins.BackendFactoryProvider, tracer trace.Tracer) *BackendClientInit {
	return &BackendClientInit{
		backendProvider: backendProvider,
		envVarProvider:  envVarProvider,
		log:             log.New("plugins.backend.registration"),
		tracer:          tracer,
	}
}

// Initialize will initialize a backend plugin client, if the plugin is a backend plugin.
func (b *BackendClientInit) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.Backend {
		backendFactory := b.backendProvider.BackendFactory(ctx, p)
		if backendFactory == nil {
			return nil, errors.New("could not find backend factory for plugin")
		}

		// this will ensure that the env variables are calculated every time a plugin is started
		envFunc := func() []string { return b.envVarProvider.PluginEnvVars(ctx, p) }

		if backendClient, err := backendFactory(p.ID, p.Logger(), b.tracer, envFunc); err != nil {
			return nil, err
		} else {
			p.RegisterClient(backendClient)
		}
	}
	return p, nil
}

// BackendClientStarter implements an InitializeFunc for starting a backend plugin process.
type BackendClientStarter struct {
	processManager process.Manager
	log            log.Logger
}

// BackendProcessStartStep returns a new InitializeFunc for starting a backend plugin process.
func BackendProcessStartStep(processManager process.Manager) InitializeFunc {
	return newBackendProcessStarter(processManager).Start
}

func newBackendProcessStarter(processManager process.Manager) *BackendClientStarter {
	return &BackendClientStarter{
		processManager: processManager,
		log:            log.New("plugins.backend.start"),
	}
}

// Start will start the backend plugin process.
func (b *BackendClientStarter) Start(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := b.processManager.Start(ctx, p); err != nil {
		b.log.Error("Could not start plugin backend", "pluginId", p.ID, "error", err)
		return nil, (&plugins.Error{
			PluginID:  p.ID,
			ErrorCode: plugins.ErrorCodeFailedBackendStart,
		}).WithMessage(err.Error())
	}
	return p, nil
}

// PluginRegistration implements an InitializeFunc for registering a plugin with the plugin registry.
type PluginRegistration struct {
	pluginRegistry registry.Service
	log            log.Logger
}

// PluginRegistrationStep returns a new InitializeFunc for registering a plugin with the plugin registry.
func PluginRegistrationStep(pluginRegistry registry.Service) InitializeFunc {
	return newPluginRegistration(pluginRegistry).Initialize
}

func newPluginRegistration(pluginRegistry registry.Service) *PluginRegistration {
	return &PluginRegistration{
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.registration"),
	}
}

// Initialize registers the plugin with the plugin registry.
func (r *PluginRegistration) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.pluginRegistry.Add(ctx, p); err != nil {
		r.log.Error("Could not register plugin", "pluginId", p.ID, "error", err)
		return nil, err
	}
	if !p.IsCorePlugin() {
		r.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return p, nil
}

// PluginInstallResourceSync syncs plugin state to PluginInstall resources in the API.
// This ensures that plugins loaded from disk are reflected as PluginInstall resources,
// enabling bidirectional sync between disk state and API state.
type PluginInstallResourceSync struct {
	clientGenerator resource.ClientGenerator
	log             log.Logger
}

// PluginInstallResourceStep returns an InitializeFunc that creates/updates
// PluginInstall resources for loaded plugins.
//
// This step runs during plugin initialization and ensures that every plugin
// loaded from disk has a corresponding PluginInstall resource in the API.
// Only external plugins are synced.
//
// If clientGenerator is nil, this step is a no-op.
func PluginInstallResourceStep(
	clientGenerator resource.ClientGenerator,
) InitializeFunc {
	return newPluginInstallResourceSync(clientGenerator).Initialize
}

func newPluginInstallResourceSync(
	clientGenerator resource.ClientGenerator,
) *PluginInstallResourceSync {
	return &PluginInstallResourceSync{
		clientGenerator: clientGenerator,
		log:             log.New("plugins.plugininstall.sync"),
	}
}

// Initialize creates or updates a PluginInstall resource for the plugin.
// This step is non-blocking - errors are logged but don't fail plugin loading.
func (s *PluginInstallResourceSync) Initialize(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if s.clientGenerator == nil {
		return p, nil
	}

	installClient, err := pluginsv0alpha1.NewPluginInstallClientFromGenerator(s.clientGenerator)
	if err != nil {
		s.log.Warn("Failed to create PluginInstall client", "error", err)
		return p, nil
	}

	namespace := "default"
	if requester, err := identity.GetRequester(ctx); err == nil {
		namespace = requester.GetNamespace()
	}

	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      p.ID,
	}

	_, err = installClient.Get(ctx, identifier)
	if err != nil {
		if kerrors.IsNotFound(err) {
			if err := s.createPluginInstallResource(ctx, p); err != nil {
				s.log.Warn("Failed to create PluginInstall resource", "pluginId", p.ID, "error", err)
			}
			return p, nil
		}
		s.log.Warn("Failed to get PluginInstall resource", "pluginId", p.ID, "error", err)
		return p, nil
	}

	s.log.Debug("PluginInstall resource already exists", "pluginId", p.ID)

	return p, nil
}

func (s *PluginInstallResourceSync) createPluginInstallResource(
	ctx context.Context,
	p *plugins.Plugin,
) error {
	installClient, err := pluginsv0alpha1.NewPluginInstallClientFromGenerator(s.clientGenerator)
	if err != nil {
		return err
	}

	// Get namespace from requester identity
	namespace := "default"
	if requester, err := identity.GetRequester(ctx); err == nil {
		namespace = requester.GetNamespace()
	}

	pluginInstall := &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Name:      p.ID,
			Namespace: namespace,
			Labels:    map[string]string{},
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			PluginID: p.ID,
			Version:  p.Info.Version,
		},
	}

	_, err = installClient.Create(ctx, pluginInstall, resource.CreateOptions{})
	if err != nil {
		if kerrors.IsAlreadyExists(err) {
			s.log.Debug("PluginInstall resource already exists", "pluginId", p.ID)
			return nil
		}
		return fmt.Errorf("failed to create PluginInstall resource: %w", err)
	}

	s.log.Info("Created PluginInstall resource from disk", "pluginId", p.ID, "version", p.Info.Version)
	return nil
}
