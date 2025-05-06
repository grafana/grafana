package datasourcecheck

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
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
}

func New(
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider pluginContextProvider,
	pluginClient plugins.Client,
	pluginRepo repo.Service,
) checks.Check {
	return &check{
		DatasourceSvc:         datasourceSvc,
		PluginStore:           pluginStore,
		PluginContextProvider: pluginContextProvider,
		PluginClient:          pluginClient,
		PluginRepo:            pluginRepo,
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
	return c.DatasourceSvc.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		UID:   id,
		OrgID: requester.GetOrgID(),
	})
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&uidValidationStep{},
		&healthCheckStep{
			PluginContextProvider: c.PluginContextProvider,
			PluginClient:          c.PluginClient,
		},
		&missingPluginStep{
			PluginStore: c.PluginStore,
			PluginRepo:  c.PluginRepo,
		},
	}
}

type uidValidationStep struct{}

func (s *uidValidationStep) ID() string {
	return UIDValidationStepID
}

func (s *uidValidationStep) Title() string {
	return "UID validation"
}

func (s *uidValidationStep) Description() string {
	return "Checks if the UID of a data source is valid."
}

func (s *uidValidationStep) Resolution() string {
	return "Check the <a href='https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement'" +
		"target=_blank>documentation</a> for more information or delete the data source and create a new one."
}

func (s *uidValidationStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) (*advisor.CheckReportFailure, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}
	// Data source UID validation
	err := util.ValidateUID(ds.UID)
	if err != nil {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			fmt.Sprintf("%s (%s)", ds.Name, ds.UID),
			ds.UID,
			[]advisor.CheckErrorLink{},
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
	return "Checks if a data sources is healthy."
}

func (s *healthCheckStep) Resolution() string {
	return "Go to the data source configuration page and address the issues reported."
}

func (s *healthCheckStep) ID() string {
	return HealthCheckStepID
}

func (s *healthCheckStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) (*advisor.CheckReportFailure, error) {
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
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			// The plugin is not installed, handle this in the missing plugin step
			return nil, nil
		}
		// Unable to check health check
		log.Error("Failed to get plugin context", "datasource_uid", ds.UID, "error", err)
		return nil, nil
	}
	req := &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
	}
	resp, err := s.PluginClient.CheckHealth(ctx, req)
	if err != nil || resp.Status != backend.HealthStatusOk {
		if err != nil {
			log.Debug("Failed to check health", "datasource_uid", ds.UID, "error", err)
			if errors.Is(err, plugins.ErrMethodNotImplemented) || errors.Is(err, plugins.ErrPluginUnavailable) {
				// The plugin does not support backend health checks
				return nil, nil
			}
		} else {
			log.Debug("Failed to check health", "datasource_uid", ds.UID, "status", resp.Status, "message", resp.Message)
		}
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			ds.Name,
			ds.UID,
			[]advisor.CheckErrorLink{
				{
					Message: "Fix me",
					Url:     fmt.Sprintf("/connections/datasources/edit/%s", ds.UID),
				},
			},
		), nil
	}
	return nil, nil
}

type missingPluginStep struct {
	PluginStore pluginstore.Store
	PluginRepo  repo.Service
}

func (s *missingPluginStep) Title() string {
	return "Missing plugin check"
}

func (s *missingPluginStep) Description() string {
	return "Checks if the plugin associated with the data source is installed."
}

func (s *missingPluginStep) Resolution() string {
	return "Delete the datasource or install the plugin."
}

func (s *missingPluginStep) ID() string {
	return MissingPluginStepID
}

func (s *missingPluginStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) (*advisor.CheckReportFailure, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}

	_, exists := s.PluginStore.Plugin(ctx, ds.Type)
	if !exists {
		links := []advisor.CheckErrorLink{
			{
				Message: "Delete data source",
				Url:     fmt.Sprintf("/connections/datasources/edit/%s", ds.UID),
			},
		}
		_, err := s.PluginRepo.PluginInfo(ctx, ds.Type)
		if err == nil {
			// Plugin is available in the repo
			links = append(links, advisor.CheckErrorLink{
				Message: "Install plugin",
				Url:     fmt.Sprintf("/plugins/%s", ds.Type),
			})
		}
		// The plugin is not installed
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			ds.Name,
			ds.UID,
			links,
		), nil
	}
	return nil, nil
}

type pluginContextProvider interface {
	GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error)
}
