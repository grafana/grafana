package sources

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// InstallPlugin represents a plugin to be installed, with class information
type InstallPlugin struct {
	ID      string
	Version string
	URL     string
	Class   string // "core", "external", "cdn"
}

// PluginInstallClientWrapper provides lazy-initialized access to PluginInstall API
type PluginInstallClientWrapper struct {
	client          *pluginsv0alpha1.PluginInstallClient
	clientGenerator resource.ClientGenerator
	initOnce        sync.Once
	initError       error
	log             log.Logger
}

// NewPluginInstallClientWrapper creates a new wrapper with lazy initialization
func NewPluginInstallClientWrapper(clientGenerator resource.ClientGenerator) *PluginInstallClientWrapper {
	return &PluginInstallClientWrapper{
		clientGenerator: clientGenerator,
		log:             log.New("plugininstall.client"),
	}
}

// getClient lazily initializes the PluginInstall client
func (w *PluginInstallClientWrapper) getClient() (*pluginsv0alpha1.PluginInstallClient, error) {
	w.initOnce.Do(func() {
		var err error
		w.client, err = pluginsv0alpha1.NewPluginInstallClientFromGenerator(w.clientGenerator)
		if err != nil {
			w.log.Error("Failed to create PluginInstall client", "error", err)
			w.initError = err
		}
	})
	return w.client, w.initError
}

// ListPluginInstalls queries the API for PluginInstall resources and converts them to InstallPlugin structs
func (w *PluginInstallClientWrapper) ListPluginInstalls(ctx context.Context, namespace string) ([]InstallPlugin, error) {
	client, err := w.getClient()
	if err != nil {
		return nil, fmt.Errorf("client not available: %w", err)
	}

	list, err := client.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return nil, err
	}

	// Convert to InstallPlugin structs
	plugins := make([]InstallPlugin, 0, len(list.Items))
	for _, item := range list.Items {
		plugins = append(plugins, InstallPlugin{
			ID:      item.Spec.Id,
			Version: item.Spec.Version,
			URL:     item.Spec.Url,
			Class:   string(item.Spec.Class),
		})
	}
	return plugins, nil
}
