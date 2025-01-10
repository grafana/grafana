package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisorv0alpha1 "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/apimachinery/pkg/runtime"
)

type DatasourceCheckImpl struct {
	datasourceSvc         datasources.DataSourceService
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
}

func New(apiBuilderSvcs *models.AdvisorAPIServices) models.Check {
	return &DatasourceCheckImpl{
		datasourceSvc:         apiBuilderSvcs.DatasourceSvc,
		pluginContextProvider: apiBuilderSvcs.PluginContextProvider,
		pluginClient:          apiBuilderSvcs.PluginClient,
	}
}

func (c *DatasourceCheckImpl) Object() runtime.Object {
	return &advisorv0alpha1.DatasourceCheck{}
}

func (c *DatasourceCheckImpl) ObjectList() runtime.Object {
	return &advisorv0alpha1.DatasourceCheckList{}
}

func (c *DatasourceCheckImpl) Name() string {
	return "datasourcecheck"
}

func (c *DatasourceCheckImpl) Kind() string {
	return "DatasourceCheck"
}

func (c *DatasourceCheckImpl) Run(ctx context.Context, obj runtime.Object) (*advisorv0alpha1.CheckStatus, error) {
	d, ok := obj.(*advisorv0alpha1.DatasourceCheck)
	if !ok {
		return nil, fmt.Errorf("invalid object type")
	}
	fmt.Println(d.Spec.Data)

	dss, err := c.datasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return nil, err
	}

	dsErrs := []advisorv0alpha1.CheckError{}
	for _, ds := range dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, advisorv0alpha1.CheckError{
				Type:   "Investigation recommended",
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
			dsErrs = append(dsErrs, advisorv0alpha1.CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Health check failed: %s", ds.Name),
				Action: "Check datasource",
			})
		}
	}

	return &advisorv0alpha1.CheckStatus{
		Errors: dsErrs,
		Count:  len(dss),
	}, nil
}
