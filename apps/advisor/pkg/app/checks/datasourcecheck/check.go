package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/klog/v2"
)

type check struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider datasource.PluginContextWrapper
	PluginClient          plugins.Client

	dss []*datasources.DataSource
}

func New(
	datasourceSvc datasources.DataSourceService,
	pluginStore pluginstore.Store,
	pluginContextProvider datasource.PluginContextWrapper,
	pluginClient plugins.Client,
) checks.Check {
	return &check{
		DatasourceSvc:         datasourceSvc,
		PluginStore:           pluginStore,
		PluginContextProvider: pluginContextProvider,
		PluginClient:          pluginClient,
	}
}

func (c *check) Init(ctx context.Context) error {
	dss, err := c.DatasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return err
	}
	c.dss = dss
	return nil
}

func (c *check) ID() string {
	return "datasource"
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&UIDValidationStep{
			dss: c.dss,
		},
		&HealthCheckStep{
			PluginContextProvider: c.PluginContextProvider,
			PluginClient:          c.PluginClient,
			dss:                   c.dss,
		},
	}
}

func (c *check) ItemsLen() int {
	return len(c.dss)
}

type UIDValidationStep struct {
	dss []*datasources.DataSource
}

func (s *UIDValidationStep) ID() string {
	return "uid-validation"
}

func (s *UIDValidationStep) Title() string {
	return "UID validation"
}

func (s *UIDValidationStep) Description() string {
	return "Check if the UID of each data source is valid."
}

func (s *UIDValidationStep) Run(ctx context.Context, obj *advisor.CheckSpec) ([]advisor.CheckReportError, error) {
	dsErrs := []advisor.CheckReportError{}
	for _, ds := range s.dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, advisor.CheckReportError{
				Severity: advisor.CheckReportErrorSeverityLow,
				Reason:   fmt.Sprintf("Invalid UID '%s' for data source %s", ds.UID, ds.Name),
				Action:   "Check the <a href='https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement' target=_blank>documentation</a> for more information.",
			})
		}
	}
	return dsErrs, nil
}

type HealthCheckStep struct {
	PluginContextProvider datasource.PluginContextWrapper
	PluginClient          plugins.Client

	dss []*datasources.DataSource
}

func (s *HealthCheckStep) Title() string {
	return "Health check"
}

func (s *HealthCheckStep) Description() string {
	return "Check if all data sources are healthy."
}

func (s *HealthCheckStep) ID() string {
	return "health-check"
}

func (s *HealthCheckStep) Run(ctx context.Context, obj *advisor.CheckSpec) ([]advisor.CheckReportError, error) {
	dsErrs := []advisor.CheckReportError{}
	for _, ds := range s.dss {
		// Health check execution
		pCtx, err := s.PluginContextProvider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
			Type:       ds.Type,
			UID:        ds.UID,
			APIVersion: ds.APIVersion,
		})
		if err != nil {
			klog.ErrorS(err, "Error creating plugin context", "datasource", ds.Name)
			continue
		}
		req := &backend.CheckHealthRequest{
			PluginContext: pCtx,
			Headers:       map[string]string{},
		}
		resp, err := s.PluginClient.CheckHealth(ctx, req)
		if err != nil {
			fmt.Println("Error checking health", err)
			continue
		}
		if resp.Status != backend.HealthStatusOk {
			dsErrs = append(dsErrs, advisor.CheckReportError{
				Severity: advisor.CheckReportErrorSeverityHigh,
				Reason:   fmt.Sprintf("Health check failed for %s", ds.Name),
				Action: fmt.Sprintf(
					"Go to the <a href='/connections/datasources/edit/%s'>data source configuration</a>"+
						" and address the issues reported.", ds.UID),
			})
		}
	}
	return dsErrs, nil
}
