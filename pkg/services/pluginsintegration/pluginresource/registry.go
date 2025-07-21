package pluginresource

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/k8s"
	sdkresource "github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

// Registry is a registry that wraps the Plugins API as the source of truth for plugins.
type Registry struct {
	pluginClient sdkresource.Client
	//pluginInstallClient sdkresource.Client
	restConfig apiserver.RestConfigProvider
	cfg        *setting.Cfg

	mem *registry.InMemory

	log      log.Logger
	initOnce sync.Once
	initErr  error
}

func ProvideService(cfg *setting.Cfg, restCfgProvider apiserver.RestConfigProvider) (*Registry, error) {
	return newRegistry(cfg, restCfgProvider), nil
}

func newRegistry(cfg *setting.Cfg, restConfig apiserver.RestConfigProvider) *Registry {
	return &Registry{
		cfg:        cfg,
		restConfig: restConfig,
		mem:        registry.NewInMemory(),
		log:        log.New("plugins.registry.enhanced"),
	}
}

// Plugin returns a plugin by its ID.
func (r *Registry) Plugin(ctx context.Context, pluginID string, version string) (*plugins.Plugin, bool) {
	if err := r.ensureClient(ctx); err != nil {
		r.log.Error("Failed to initialize plugin client", "error", err)
		return nil, false
	}

	//namespace, err := r.getNamespace(ctx)
	//if err != nil {
	//	r.log.Error("Failed to get namespace")
	//	return nil, false
	//}
	//
	//pluginInstallIdentifier := sdkresource.Identifier{
	//	Name:      pluginID,
	//	Namespace: namespace,
	//}
	//
	//_, err = r.pluginInstallClient.Get(ctx, pluginInstallIdentifier)
	//if err != nil {
	//	if !apierrors.IsNotFound(err) {
	//		r.log.Error("Failed to get plugin install from Kubernetes", "plugin", pluginID, "error", err)
	//	}
	//	return nil, false
	//}

	pluginIdentifier := sdkresource.Identifier{
		Name:      pluginID,
		Namespace: metav1.NamespaceAll,
	}

	_, err := r.pluginClient.Get(ctx, pluginIdentifier)
	if err != nil {
		if !apierrors.IsNotFound(err) {
			r.log.Error("Failed to get plugin from Kubernetes", "plugin", pluginID, "error", err)
		}
		return nil, false
	}

	return r.mem.Plugin(ctx, pluginID, version)

	// Convert Kubernetes resource to plugin
	//if plugin, ok := pluginResource.(*pluginsv0alpha1.Plugin); ok {
	//	// Create a new plugin instance from the Kubernetes resource
	//	return specToPlugin(plugin.Spec), true
	//}
	//return nil, false
}

// Plugins returns all plugins.
func (r *Registry) Plugins(ctx context.Context) []*plugins.Plugin {
	if err := r.ensureClient(ctx); err != nil {
		r.log.Error("Failed to initialize plugin client", "error", err)
		return nil
	}

	var ps []*plugins.Plugin

	// List all plugins (cluster-scoped)
	_, err := r.pluginClient.List(ctx, metav1.NamespaceAll, sdkresource.ListOptions{})
	if err != nil {
		r.log.Error("Failed to list plugins from Kubernetes", "error", err)
		return ps
	}

	return r.mem.Plugins(ctx)
	//for _, plugin := range pluginList.GetItems() {
	//	p, ok := plugin.(*pluginsv0alpha1.Plugin)
	//	if !ok {
	//		r.log.Error("Failed to get plugin spec from Kubernetes", "error", err)
	//		continue
	//	}
	//	ps = append(ps, specToPlugin(p.Spec))
	//}
	//
	//return ps
}

// Add adds a plugin to the registry.
func (r *Registry) Add(ctx context.Context, p *plugins.Plugin) error {
	if err := r.ensureClient(ctx); err != nil {
		return fmt.Errorf("failed to initialize plugin client: %w", err)
	}

	//namespace, err := r.getNamespace(ctx)
	//if err != nil {
	//	return err
	//}

	// Create plugin identifier
	pluginIdentifier := sdkresource.Identifier{
		Name:      p.ID,
		Namespace: metav1.NamespaceAll,
	}

	// Create plugin resource
	pluginResource := &pluginsv0alpha1.Plugin{
		TypeMeta: metav1.TypeMeta{
			Kind:       pluginsv0alpha1.PluginKind().Kind(),
			APIVersion: pluginsv0alpha1.PluginKind().Version(),
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      p.ID,
			Namespace: metav1.NamespaceAll,
		},
		Spec: pluginsv0alpha1.PluginSpec{
			PluginJSON: pluginsv0alpha1.PluginJSONData{
				Name: p.ID,
				Info: pluginsv0alpha1.PluginInfo{
					Version: p.Info.Version,
				},
			},
		},
	}

	var statusErr *apierrors.StatusError
	// Check if plugin exists
	existingPlugin, err := r.pluginClient.Get(ctx, pluginIdentifier)
	if err != nil {
		if !errors.As(err, &statusErr) || statusErr.ErrStatus.Code != 404 {
			r.log.Error("Failed to get plugin resource", "plugin", p.ID, "error", err)
			return err
		}
		// Plugin doesn't exist, create it
		_, err = r.pluginClient.Create(ctx, pluginIdentifier, pluginResource, sdkresource.CreateOptions{})
		if err != nil {
			r.log.Error("Failed to create plugin resource", "plugin", p.ID, "error", err, "errorType", fmt.Sprintf("%T", err))
			return err
		}
	} else {
		// Update existing plugin
		if meta, ok := existingPlugin.(metav1.Object); ok {
			pluginResource.ObjectMeta.UID = meta.GetUID()
			pluginResource.ObjectMeta.ResourceVersion = meta.GetResourceVersion()
		}
		_, err = r.pluginClient.Update(ctx, pluginIdentifier, pluginResource, sdkresource.UpdateOptions{})
		if err != nil {
			r.log.Error("Failed to update plugin resource", "plugin", p.ID, "error", err)
			return err
		}
	}

	//// Create plugin install identifier
	//pluginInstallIdentifier := sdkresource.Identifier{
	//	Name:      p.ID,
	//	Namespace: namespace,
	//}
	//
	//// Check if recorded plugin install
	//
	//pluginInstallResource := &pluginsv0alpha1.PluginInstall{
	//	TypeMeta: metav1.TypeMeta{
	//		Kind:       pluginsv0alpha1.PluginInstallKind().Kind(),
	//		APIVersion: pluginsv0alpha1.PluginInstallKind().Version(),
	//	},
	//	ObjectMeta: metav1.ObjectMeta{
	//		Name:      p.ID,
	//		Namespace: namespace,
	//	},
	//	Spec: pluginsv0alpha1.PluginInstallSpec{
	//		Id:      p.ID,
	//		Version: p.Info.Version,
	//	},
	//}

	//existingPluginInstall, err := r.pluginInstallClient.Get(ctx, pluginInstallIdentifier)
	//if err != nil {
	//	if !errors.As(err, &statusErr) || statusErr.ErrStatus.Code != 404 {
	//		r.log.Error("Failed to get plugin install resource", "plugin", p.ID, "error", err)
	//		return err
	//	}
	//	// Plugin doesn't exist, create it
	//	_, err = r.pluginInstallClient.Create(ctx, pluginInstallIdentifier, pluginInstallResource, sdkresource.CreateOptions{})
	//	if err != nil {
	//		r.log.Error("Failed to create plugin install resource", "plugin", p.ID, "error", err)
	//		return err
	//	}
	//} else {
	//	// Update existing plugin
	//	if meta, ok := existingPluginInstall.(metav1.Object); ok {
	//		pluginInstallResource.ObjectMeta.UID = meta.GetUID()
	//		pluginInstallResource.ObjectMeta.ResourceVersion = meta.GetResourceVersion()
	//	}
	//	_, err = r.pluginInstallClient.Update(ctx, pluginInstallIdentifier, pluginInstallResource, sdkresource.UpdateOptions{})
	//	if err != nil {
	//		r.log.Error("Failed to update plugin install resource", "plugin", p.ID, "error", err)
	//		return err
	//	}
	//}

	return r.mem.Add(ctx, p)
}

// Remove removes a plugin from the registry.
func (r *Registry) Remove(ctx context.Context, pluginID string, version string) error {
	if err := r.ensureClient(ctx); err != nil {
		return fmt.Errorf("failed to initialize plugin client: %w", err)
	}

	_, err := r.getNamespace(ctx)
	if err != nil {
		return err
	}

	identifier := sdkresource.Identifier{
		Name:      pluginID,
		Namespace: metav1.NamespaceAll,
	}

	err = r.pluginClient.Delete(ctx, identifier, sdkresource.DeleteOptions{})
	if err != nil {
		r.log.Error("Failed to delete plugin resource", "plugin", pluginID, "error", err)
		return err
	}

	return r.mem.Remove(ctx, pluginID, version)
}

// ensureClient ensures the plugin client is initialized
func (r *Registry) ensureClient(ctx context.Context) error {
	r.initOnce.Do(func() {
		r.initErr = r.initializeClientWithRetry(ctx)
	})
	return r.initErr
}

// initializeClientWithRetry handles the client initialization with retry logic
func (r *Registry) initializeClientWithRetry(ctx context.Context) error {
	const maxAttempts = 50
	const retryDelay = 2 * time.Second

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := r.createPluginClients(ctx); err != nil {
			lastErr = err
			r.log.Error("Failed to initialize plugin clients", "attempt", attempt, "error", err)

			if attempt == maxAttempts {
				panic(fmt.Errorf("could not initialize plugin clients after %d attempts: %w", maxAttempts, err))
			}

			time.Sleep(retryDelay)
			continue
		}

		// Test the clients by doing a simple list operation
		if err := r.testPluginClients(ctx); err != nil {
			lastErr = err
			r.log.Error("Plugin clients test failed", "attempt", attempt, "error", err, "status_code", errAsStatusCode(err))

			if attempt == maxAttempts {
				panic(fmt.Errorf("plugin clients test failed after %d attempts: %w", maxAttempts, err))
			}

			time.Sleep(retryDelay)
			continue
		}

		// Success
		return nil
	}

	return lastErr
}

// createPluginClients creates and configures the plugin client
func (r *Registry) createPluginClients(ctx context.Context) error {
	kubeConfig, err := r.restConfig.GetRestConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get REST config: %w", err)
	}
	clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.ClientConfig{})

	pluginClient, err := clientGenerator.ClientFor(pluginsv0alpha1.PluginKind())
	if err != nil {
		return fmt.Errorf("failed to create plugin client: %w", err)
	}
	r.pluginClient = pluginClient

	//pluginInstallClient, err := clientGenerator.ClientFor(pluginsv0alpha1.PluginInstallKind())
	//if err != nil {
	//	return fmt.Errorf("failed to create plugin install client: %w", err)
	//}
	//r.pluginInstallClient = pluginInstallClient

	return nil
}

// testPluginClients tests the plugin clients with list operations
func (r *Registry) testPluginClients(ctx context.Context) error {
	r.log.Info("Testing plugin client with list operation")
	_, err := r.pluginClient.List(ctx, metav1.NamespaceAll, sdkresource.ListOptions{Limit: 1})
	if err != nil {
		r.log.Error("Plugin client list test failed", "error", err, "errorType", fmt.Sprintf("%T", err))
		return err
	}

	//r.log.Info("Testing plugin install client with list operation")
	//_, err = r.pluginInstallClient.List(ctx, metav1.NamespaceNone, sdkresource.ListOptions{Limit: 1})
	//if err != nil {
	//	r.log.Error("Plugin install client list test failed", "error", err, "errorType", fmt.Sprintf("%T", err))
	//}
	return err
}

func (r *Registry) getNamespace(ctx context.Context) (string, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if ok {
		return namespace, nil
	}

	if r.cfg.StackID == "" {
		return metav1.NamespaceDefault, nil
	}
	stackID, err := strconv.ParseInt(r.cfg.StackID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid stack id: %s", r.cfg.StackID)
	}
	return types.CloudNamespaceFormatter(stackID), nil
}

func specToPlugin(spec pluginsv0alpha1.PluginSpec) *plugins.Plugin {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: spec.PluginJSON.Id,
			Info: plugins.Info{
				Description: "Plugin loaded from Kubernetes",
				Version:     spec.PluginJSON.Info.Version,
			},
		},
	}
	p.SetLogger(log.New(fmt.Sprintf("plugin.%s", spec.PluginJSON.Id)))
	return p
}

// errAsStatusCode extracts status code from kubernetes errors
func errAsStatusCode(err error) int {
	if status, ok := k8s.StatusFromError(err); ok {
		return int(status.Status().Code)
	}
	return 0
}
