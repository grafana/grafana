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
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider pluginContextProvider
	PluginClient          plugins.Client
	PluginRepo            repo.Service
	GrafanaVersion        string
	pluginExistsCache     map[string]bool
	pluginExistsCacheMu   sync.RWMutex
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
		DatasourceSvc:         datasourceSvc,
		PluginStore:           pluginStore,
		PluginContextProvider: pluginContextProvider,
		PluginClient:          pluginClient,
		PluginRepo:            pluginRepo,
		GrafanaVersion:        grafanaVersion,
		pluginExistsCache:     make(map[string]bool),
	}
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	dss, err := c.DatasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
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
			GetPluginExistsFunc: c.getPluginExistsFunc,
		},
	}
}

func (c *check) getPluginExistsFunc(ctx context.Context, pluginType string) (bool, error) {
	// Check cache first with read lock
	c.pluginExistsCacheMu.RLock()
	if exists, found := c.pluginExistsCache[pluginType]; found {
		c.pluginExistsCacheMu.RUnlock()
		return exists, nil
	}
	c.pluginExistsCacheMu.RUnlock()

	// Cache miss, fetch from repo with write lock
	c.pluginExistsCacheMu.Lock()
	defer c.pluginExistsCacheMu.Unlock()

	// Double-check in case another goroutine fetched it while we were waiting for the lock
	if exists, found := c.pluginExistsCache[pluginType]; found {
		return exists, nil
	}

	// Fetch from repository
	plugins, err := c.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           []string{pluginType},
	}, repo.NewCompatOpts(c.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH))
	if err != nil {
		return false, err
	}

	// Cache the result
	exists := len(plugins) > 0
	c.pluginExistsCache[pluginType] = exists
	return exists, nil
}

type pluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}
