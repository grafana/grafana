package datasourcecheck

import (
	"context"
	"errors"
	sysruntime "runtime"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	CheckID             = "datasource"
	HealthCheckStepID   = "health-check"
	UIDValidationStepID = "uid-validation"
	MissingPluginStepID = "missing-plugin"
	PromDepAuthStepID   = "prom-dep-auth"
)

type check struct {
	DatasourceSvc             datasources.DataSourceService
	PluginStore               pluginstore.Store
	PluginContextProvider     pluginContextProvider
	PluginClient              plugins.Client
	PluginRepo                repo.Service
	GrafanaVersion            string
	pluginCanBeInstalledCache map[string]bool
	pluginExistsCacheMu       sync.RWMutex
}

func New(
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider pluginContextProvider,
	pluginClient plugins.Client,
	pluginRepo repo.Service,
	grafanaVersion string,
) checks.Check {
	return &check{
		DatasourceSvc:             datasourceSvc,
		PluginStore:               pluginStore,
		PluginContextProvider:     pluginContextProvider,
		PluginClient:              pluginClient,
		PluginRepo:                pluginRepo,
		GrafanaVersion:            grafanaVersion,
		pluginCanBeInstalledCache: make(map[string]bool),
	}
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	dss, err := c.DatasourceSvc.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID: requester.GetOrgID(),
	})
	if err != nil {
		return nil, err
	}
	res := make([]any, len(dss))
	for i, ds := range dss {
		res[i] = ds
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := c.DatasourceSvc.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		UID:   id,
		OrgID: requester.GetOrgID(),
	})
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			// The data source does not exist, skip the check
			return nil, nil
		}
		return nil, err
	}
	return ds, nil
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Name() string {
	return "data source"
}

func (c *check) Init(ctx context.Context) error {
	c.pluginCanBeInstalledCache = make(map[string]bool)
	return nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&uidValidationStep{},
		&healthCheckStep{
			PluginContextProvider: c.PluginContextProvider,
			PluginClient:          c.PluginClient,
		},
		&missingPluginStep{
			PluginStore:    c.PluginStore,
			PluginRepo:     c.PluginRepo,
			GrafanaVersion: c.GrafanaVersion,
		},
		&promDepAuthStep{
			canBeInstalled: c.canBeInstalled,
		},
	}
}

// canBeInstalled checks if a plugin is already installed or if it's available in the plugin repository.
// Returns true if:
// - The plugin is NOT installed AND it IS available in the repository (can be installed)
// Returns false if:
// - The plugin is already installed, OR
// - The plugin is NOT available in the repository (nothing to install)
func (c *check) canBeInstalled(ctx context.Context, pluginType string) (bool, error) {
	// Check cache first with read lock for performance
	c.pluginExistsCacheMu.RLock()
	if canBeInstalled, found := c.pluginCanBeInstalledCache[pluginType]; found {
		c.pluginExistsCacheMu.RUnlock()
		return canBeInstalled, nil
	}
	c.pluginExistsCacheMu.RUnlock()

	// Cache miss - acquire write lock and check again (double-checked locking pattern)
	c.pluginExistsCacheMu.Lock()
	defer c.pluginExistsCacheMu.Unlock()

	// Another goroutine may have populated the cache while we waited for the lock
	if canBeInstalled, found := c.pluginCanBeInstalledCache[pluginType]; found {
		return canBeInstalled, nil
	}

	// Check if plugin is already installed
	if _, isInstalled := c.PluginStore.Plugin(ctx, pluginType); isInstalled {
		c.pluginCanBeInstalledCache[pluginType] = false
		return false, nil
	}

	// Plugin is not installed - check if it's available in the repository
	availablePlugins, err := c.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           []string{pluginType},
	}, repo.NewCompatOpts(c.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH))
	if err != nil {
		// On error, assume plugin is installed/unavailable to avoid showing incorrect install links
		return false, err
	}

	// Plugin is not installed but IS available - return false to show install link
	// Plugin is not installed and NOT available in repo - return true (nothing to install)
	isAvailableInRepo := len(availablePlugins) > 0
	c.pluginCanBeInstalledCache[pluginType] = !isAvailableInRepo
	return isAvailableInRepo, nil
}

type pluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}
