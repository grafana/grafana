package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

type genericStrategy interface {
	rest.RESTCreateStrategy
	rest.RESTUpdateStrategy
}

type userstorageStrategy struct {
	genericStrategy

	datasourceSvc         datasources.DataSourceService
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
}

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, datasourceSvc datasources.DataSourceService, pluginContextProvider *plugincontext.Provider, pluginClient plugins.Client) *userstorageStrategy {
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &userstorageStrategy{genericStrategy, datasourceSvc, pluginContextProvider, pluginClient}
}

func (g *userstorageStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		// TODO: Errors may need to be at least logged
		return
	}

	dss, err := g.datasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
	if err != nil {
		return
	}

	dsErrs := []advisor.CheckError{}
	for _, ds := range dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, advisor.CheckError{
				Type:   "Investigation recommended",
				Reason: fmt.Sprintf("Invalid UID: %s", ds.UID),
				Action: "Change UID",
			})
		}

		// Health check execution
		identity := &user.SignedInUser{OrgID: int64(1), Login: "admin"}
		pCtx, err := g.pluginContextProvider.GetWithDataSource(ctx, ds.Type, identity, ds)
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

		resp, err := g.pluginClient.CheckHealth(ctx, req)
		if err != nil {
			fmt.Println("Error checking health", err)
			continue
		}

		if resp.Status != backend.HealthStatusOk {
			dsErrs = append(dsErrs, advisor.CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Health check failed: %s", ds.Name),
				Action: "Check datasource",
			})
		}
	}

	// Store result in the status
	err = meta.SetStatus(advisor.DatasourceCheckStatus{
		Errors: dsErrs,
		Count:  len(dss),
	})
	if err != nil {
		return
	}
}
