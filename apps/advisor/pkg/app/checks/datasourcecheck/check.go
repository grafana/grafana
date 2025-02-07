package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
)

type check struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider pluginContextProvider
	PluginClient          plugins.Client
}

func New(
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider pluginContextProvider,
	pluginClient plugins.Client,
) checks.Check {
	return &check{
		DatasourceSvc:         datasourceSvc,
		PluginStore:           pluginStore,
		PluginContextProvider: pluginContextProvider,
		PluginClient:          pluginClient,
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

func (c *check) ID() string {
	return "datasource"
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&uidValidationStep{},
		&healthCheckStep{
			PluginContextProvider: c.PluginContextProvider,
			PluginClient:          c.PluginClient,
		},
	}
}

type uidValidationStep struct{}

func (s *uidValidationStep) ID() string {
	return "uid-validation"
}

func (s *uidValidationStep) Title() string {
	return "UID validation"
}

func (s *uidValidationStep) Description() string {
	return "Check if the UID of each data source is valid."
}

func (s *uidValidationStep) Run(ctx context.Context, obj *advisor.CheckSpec, i any) (*advisor.CheckReportError, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}
	// Data source UID validation
	err := util.ValidateUID(ds.UID)
	if err != nil {
		return checks.NewCheckReportError(
			advisor.CheckReportErrorSeverityLow,
			fmt.Sprintf("Invalid UID '%s' for data source %s", ds.UID, ds.Name),
			"Check the <a href='https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement' target=_blank>documentation</a> for more information.",
			s.ID(),
			ds.UID,
		), nil
	}
	return nil, nil
}

type healthCheckStep struct {
	PluginContextProvider pluginContextProvider
	PluginClient          plugins.Client
}

func (s *healthCheckStep) Title() string {
	return "Health check"
}

func (s *healthCheckStep) Description() string {
	return "Check if all data sources are healthy."
}

func (s *healthCheckStep) ID() string {
	return "health-check"
}

func (s *healthCheckStep) Run(ctx context.Context, obj *advisor.CheckSpec, i any) (*advisor.CheckReportError, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}

	// Health check execution
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	pCtx, err := s.PluginContextProvider.GetWithDataSource(ctx, ds.Type, requester, ds)
	if err != nil {
		return nil, fmt.Errorf("failed to get plugin context: %w", err)
	}
	req := &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
	}
	resp, err := s.PluginClient.CheckHealth(ctx, req)
	if err != nil || resp.Status != backend.HealthStatusOk {
		return checks.NewCheckReportError(
			advisor.CheckReportErrorSeverityHigh,
			fmt.Sprintf("Health check failed for %s", ds.Name),
			fmt.Sprintf(
				"Go to the <a href='/connections/datasources/edit/%s'>data source configuration</a>"+
					" and address the issues reported.", ds.UID),
			s.ID(),
			ds.UID,
		), nil
	}
	return nil, nil
}

type pluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}
