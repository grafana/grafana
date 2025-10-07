package initialization

import (
	"context"
	"errors"
	"fmt"
	"os"

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
//
// This step works in conjunction with the PluginInstall reconciler:
//   - API → Disk: Reconciler installs plugins from PluginInstall resources
//   - Disk → API: This step syncs plugins loaded from disk back to API
//
// Only external plugins are synced (core plugins are skipped).
// Errors are logged but don't fail plugin loading.
type PluginInstallResourceSync struct {
	clientGenerator resource.ClientGenerator
	nodeName        string
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
	nodeName := os.Getenv("HOSTNAME")
	if nodeName == "" {
		nodeName = "grafana-instance"
	}

	return newPluginInstallResourceSync(clientGenerator, nodeName).Initialize
}

func newPluginInstallResourceSync(
	clientGenerator resource.ClientGenerator,
	nodeName string,
) *PluginInstallResourceSync {
	return &PluginInstallResourceSync{
		clientGenerator: clientGenerator,
		nodeName:        nodeName,
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

	// Check if PluginInstall resource exists
	existing, err := installClient.Get(ctx, identifier)
	if err != nil {
		if kerrors.IsNotFound(err) {
			// Resource doesn't exist, create it
			if err := s.createPluginInstallResource(ctx, p); err != nil {
				s.log.Warn("Failed to create PluginInstall resource",
					"pluginId", p.ID, "error", err)
			}
			// Don't fail plugin loading on resource creation errors
			return p, nil
		}
		// Other errors - log and continue
		s.log.Warn("Failed to get PluginInstall resource",
			"pluginId", p.ID, "error", err)
		return p, nil
	}

	// Resource exists, update status
	if err := s.updatePluginInstallStatus(ctx, p, existing); err != nil {
		s.log.Warn("Failed to update PluginInstall status",
			"pluginId", p.ID, "error", err)
	}

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

	// Determine source type based on plugin class
	sourceType := "catalog"
	if p.Class == plugins.ClassExternal {
		// Could be from catalog, URL, or local - default to catalog
		sourceType = "catalog"
	}

	installedVersion := p.Info.Version
	pluginClass := string(p.Class)

	pluginInstall := &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Name:      p.ID,
			Namespace: namespace,
			Labels: map[string]string{
				"grafana.app/plugin-id": p.ID,
				"grafana.app/source":    "disk-sync",
			},
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			PluginID: p.ID,
			Version:  p.Info.Version,
			Source: &pluginsv0alpha1.PluginInstallV0alpha1SpecSource{
				Type: sourceType,
			},
		},
		Status: pluginsv0alpha1.PluginInstallStatus{
			NodeStatus: map[string]pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
				s.nodeName: {
					NodeName:         s.nodeName,
					Phase:            "Ready",
					InstalledVersion: &installedVersion,
					PluginClass:      &pluginClass,
				},
			},
		},
	}

	_, err = installClient.Create(ctx, pluginInstall, resource.CreateOptions{})
	if err != nil {
		if kerrors.IsAlreadyExists(err) {
			// Race condition - another pod created it
			s.log.Debug("PluginInstall resource already exists", "pluginId", p.ID)
			return nil
		}
		return fmt.Errorf("failed to create PluginInstall resource: %w", err)
	}

	s.log.Info("Created PluginInstall resource from disk", "pluginId", p.ID, "version", p.Info.Version)
	return nil
}

func (s *PluginInstallResourceSync) updatePluginInstallStatus(
	ctx context.Context,
	p *plugins.Plugin,
	existing *pluginsv0alpha1.PluginInstall,
) error {
	installClient, err := pluginsv0alpha1.NewPluginInstallClientFromGenerator(s.clientGenerator)
	if err != nil {
		return err
	}

	// Initialize node status map if needed
	if existing.Status.NodeStatus == nil {
		existing.Status.NodeStatus = make(map[string]pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus)
	}

	// Update this node's status
	installedVersion := p.Info.Version
	pluginClass := string(p.Class)
	existing.Status.NodeStatus[s.nodeName] = pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
		NodeName:         s.nodeName,
		Phase:            "Ready",
		InstalledVersion: &installedVersion,
		PluginClass:      &pluginClass,
	}

	// Calculate aggregate status
	s.calculateAggregateStatus(existing)

	// Get namespace from requester identity
	namespace := "default"
	if requester, err := identity.GetRequester(ctx); err == nil {
		namespace = requester.GetNamespace()
	}

	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      p.ID,
	}

	// Update status with retry on conflict
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		_, err := installClient.UpdateStatus(ctx, identifier, existing.Status, resource.UpdateOptions{
			ResourceVersion: existing.ResourceVersion,
		})

		if err == nil {
			s.log.Debug("Updated PluginInstall status from disk",
				"pluginId", p.ID, "node", s.nodeName, "version", p.Info.Version)
			return nil
		}

		// If conflict, retry with latest version
		if kerrors.IsConflict(err) {
			existing, err = installClient.Get(ctx, identifier)
			if err != nil {
				return fmt.Errorf("failed to get PluginInstall for retry: %w", err)
			}

			if existing.Status.NodeStatus == nil {
				existing.Status.NodeStatus = make(map[string]pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus)
			}
			existing.Status.NodeStatus[s.nodeName] = pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
				NodeName:         s.nodeName,
				Phase:            "Ready",
				InstalledVersion: &installedVersion,
				PluginClass:      &pluginClass,
			}
			s.calculateAggregateStatus(existing)
			continue
		}

		return fmt.Errorf("failed to update status: %w", err)
	}

	return fmt.Errorf("failed to update status after %d retries", maxRetries)
}

// calculateAggregateStatus calculates the overall status from individual node statuses
func (s *PluginInstallResourceSync) calculateAggregateStatus(pluginInstall *pluginsv0alpha1.PluginInstall) {
	ready := int64(0)
	installing := int64(0)
	failed := int64(0)

	for _, status := range pluginInstall.Status.NodeStatus {
		switch status.Phase {
		case "Ready":
			ready++
		case "Installing":
			installing++
		case "Failed":
			failed++
		}
	}

	pluginInstall.Status.ReadyNodes = &ready
	pluginInstall.Status.InstallingNodes = &installing
	pluginInstall.Status.FailedNodes = &failed
	total := int64(len(pluginInstall.Status.NodeStatus))
	pluginInstall.Status.TotalNodes = &total

	// Determine overall phase
	if ready == total && total > 0 {
		phase := "Ready"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Plugin installed on all %d nodes", total)
		pluginInstall.Status.Message = &msg
	} else if installing > 0 {
		phase := "Installing"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Installing on %d/%d nodes", installing, total)
		pluginInstall.Status.Message = &msg
	} else if failed > 0 && ready > 0 {
		phase := "PartiallyFailed"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Failed on %d nodes, ready on %d nodes", failed, ready)
		pluginInstall.Status.Message = &msg
	} else if failed > 0 {
		phase := "Failed"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Failed on %d/%d nodes", failed, total)
		pluginInstall.Status.Message = &msg
	}
}
