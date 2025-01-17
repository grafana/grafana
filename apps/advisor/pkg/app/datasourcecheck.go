package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

type datasourceCheckRegisterer struct{}

func (r *datasourceCheckRegisterer) New(cfg *AdvisorConfig) check {
	return &datasourceCheckImpl{
		datasourceSvc:         cfg.DatasourceSvc,
		pluginContextProvider: cfg.PluginContextProvider,
		pluginClient:          cfg.PluginClient,
	}
}

func (r *datasourceCheckRegisterer) Kind() resource.Kind {
	return advisor.DatasourceCheckKind()
}

func init() {
	registerChecks = append(registerChecks, &datasourceCheckRegisterer{})
}

type datasourceCheckImpl struct {
	datasourceSvc         datasources.DataSourceService
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
}

func (c *datasourceCheckImpl) Run(ctx context.Context, obj resource.Object) (resource.Object, error) {
	// Optionally read the check input encoded in the object
	d, ok := obj.(*advisor.DatasourceCheck)
	if !ok {
		return nil, fmt.Errorf("invalid object type")
	}
	fmt.Println(d.Spec)

	dss, err := c.datasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return nil, err
	}

	dsErrs := []advisor.DatasourceCheckV0alpha1StatusReportErrors{}
	for _, ds := range dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, advisor.DatasourceCheckV0alpha1StatusReportErrors{
				Type:   advisor.DatasourceCheckStatusTypeInvestigation,
				Reason: fmt.Sprintf("Invalid UID: %s", ds.UID),
				Action: "Change UID",
			})
		}

		// Health check execution
		identity := &user.SignedInUser{OrgID: int64(1), Login: "admin"}
		pCtx, err := c.pluginContextProvider.GetWithDataSource(ctx, ds.Type, identity, ds)
		if err != nil {
			fmt.Println("Error getting plugin context", err)
			continue
		}
		req := &backend.CheckHealthRequest{
			PluginContext: pCtx,
			Headers:       map[string]string{},
		}

		// Skipping DS URL validation
		// var dsURL string
		// if req.PluginContext.DataSourceInstanceSettings != nil {
		// 	dsURL = req.PluginContext.DataSourceInstanceSettings.URL
		// }
		// err = hs.PluginRequestValidator.Validate(dsURL, c.Req)
		// if err != nil {
		// 	fmt.Println("Error validating plugin request", err)
		// 	continue
		// }

		resp, err := c.pluginClient.CheckHealth(ctx, req)
		if err != nil {
			fmt.Println("Error checking health", err)
			continue
		}

		if resp.Status != backend.HealthStatusOk {
			dsErrs = append(dsErrs, advisor.DatasourceCheckV0alpha1StatusReportErrors{
				Type:   advisor.DatasourceCheckStatusTypeAction,
				Reason: fmt.Sprintf("Health check failed: %s", ds.Name),
				Action: "Check datasource",
			})
		}
	}

	// Store result in the object
	d.DatasourceCheckStatus = advisor.DatasourceCheckStatus{
		Report: advisor.DatasourceCheckV0alpha1StatusReport{
			Count:  int64(len(dss)),
			Errors: dsErrs,
		},
	}
	return d, nil
}
