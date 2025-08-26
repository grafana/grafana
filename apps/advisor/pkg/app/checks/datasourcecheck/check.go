package datasourcecheck

import (
	"context"
	"errors"

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
)

type check struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider pluginContextProvider
	PluginClient          plugins.Client
	PluginRepo            repo.Service
	GrafanaVersion        string
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
	}
}

type pluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}
