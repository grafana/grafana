package app

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/simple"

	plugincatalogv0alpha1 "github.com/grafana/grafana/apps/plugincatalog/pkg/apis/plugincatalog/v0alpha1"
)

// Plugin represents a plugin from the catalog
type Plugin struct {
	Slug          string
	Status        string
	SignatureType string
}

// PluginCatalogFetcher fetches plugin catalog data from an external source
type PluginCatalogFetcher interface {
	GetPlugins(ctx context.Context, requestID string) (map[string]Plugin, error)
}

// Config holds configuration for the plugin catalog syncer
type Config struct {
	SyncInterval time.Duration
	MaxRetries   int
	CleanupStale bool
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{
		SyncInterval: time.Hour,
		MaxRetries:   3,
		CleanupStale: false,
	}
}

// PluginCatalogAppConfig holds the specific configuration for the plugin catalog app
type PluginCatalogAppConfig struct {
	Fetcher    PluginCatalogFetcher
	Config     Config
	EnableSync bool
}

// New creates a new plugin catalog app
func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*PluginCatalogAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	simpleConfig := simple.AppConfig{
		Name:       "plugincatalog",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: plugincatalogv0alpha1.PluginKind(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if specificConfig.EnableSync {
		clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
		pluginClient, err := plugincatalogv0alpha1.NewPluginClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, fmt.Errorf("failed to create plugin client: %w", err)
		}

		syncer := NewCatalogSyncer(
			specificConfig.Fetcher,
			pluginClient,
			specificConfig.Config,
		)
		a.AddRunnable(syncer)
	}

	return a, nil
}
