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

type check struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginContextProvider datasource.PluginContextWrapper
	PluginClient          plugins.Client
}

func (c *check) Type() string {
	return "datasource"
}

func (c *check) Run(ctx context.Context, obj *advisor.CheckSpec) (*advisor.CheckV0alpha1StatusReport, error) {
	// Optionally read the check input encoded in the object
	// fmt.Println(obj.Data)

	dss, err := c.DatasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return nil, err
	}

	dsErrs := []advisor.CheckV0alpha1StatusReportErrors{}
	for _, ds := range dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, advisor.CheckV0alpha1StatusReportErrors{
				Severity: advisor.CheckStatusSeverityLow,
				Reason:   fmt.Sprintf("Invalid UID '%s' for data source %s", ds.UID, ds.Name),
				Action:   "Check the <a href='https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement' target=_blank>documentation</a> for more information.",
			})
		}

		// Health check execution
		pCtx, err := c.PluginContextProvider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
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
		resp, err := c.PluginClient.CheckHealth(ctx, req)
		if err != nil {
			fmt.Println("Error checking health", err)
			continue
		}
		if resp.Status != backend.HealthStatusOk {
			dsErrs = append(dsErrs, advisor.CheckV0alpha1StatusReportErrors{
				Severity: advisor.CheckStatusSeverityHigh,
				Reason:   fmt.Sprintf("Health check failed for %s", ds.Name),
				Action: fmt.Sprintf(
					"Go to the <a href='/connections/datasources/edit/%s'>data source configuration</a>"+
						" and address the issues reported.", ds.UID),
			})
		}
	}

	return &advisor.CheckV0alpha1StatusReport{
		Count:  int64(len(dss)),
		Errors: dsErrs,
	}, nil
}
