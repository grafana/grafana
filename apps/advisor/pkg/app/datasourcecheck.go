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

// TODO: This should be defined in cue
type CheckError struct {
	Type   string `json:"type"`   // Investigation or Action recommended
	Reason string `json:"reason"` // Why the check is failing
	Action string `json:"action"` // Call to action
}

type CheckStatus struct {
	Count  int          `json:"count"`  // Number of Datasources analyzed
	Errors []CheckError `json:"errors"` // List of errors found
}

type checkRegisterer func(cfg *AdvisorConfig) Check

type Check interface {
	Run(ctx context.Context, obj resource.Object) (*CheckStatus, error)
	Updated(ctx context.Context, obj resource.Object) (bool, error)
	Kind() resource.Kind
}

func NewDatasourceCheck(cfg *AdvisorConfig) Check {
	return &DatasourceCheckImpl{
		datasourceSvc:         cfg.DatasourceSvc,
		pluginContextProvider: cfg.PluginContextProvider,
		pluginClient:          cfg.PluginClient,
	}
}

func init() {
	registerChecks = append(registerChecks, NewDatasourceCheck)
}

type DatasourceCheckImpl struct {
	datasourceSvc         datasources.DataSourceService
	pluginContextProvider *plugincontext.Provider
	pluginClient          plugins.Client
}

func (c *DatasourceCheckImpl) Run(ctx context.Context, obj resource.Object) (*CheckStatus, error) {
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

	dsErrs := []CheckError{}
	for _, ds := range dss {
		// Data source UID validation
		err := util.ValidateUID(ds.UID)
		if err != nil {
			dsErrs = append(dsErrs, CheckError{
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
			dsErrs = append(dsErrs, CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Health check failed: %s", ds.Name),
				Action: "Check datasource",
			})
		}
	}

	return &CheckStatus{
		Errors: dsErrs,
		Count:  len(dss),
	}, nil
}

func (c *DatasourceCheckImpl) Updated(ctx context.Context, obj resource.Object) (bool, error) {
	// Optionally read the check input encoded in the object
	d, ok := obj.(*advisor.DatasourceCheck)
	if !ok {
		return false, fmt.Errorf("invalid object type")
	}
	if d.DatasourceCheckStatus.AdditionalFields != nil {
		// Already processed
		return true, nil
	}
	return false, nil
}

func (c *DatasourceCheckImpl) Kind() resource.Kind {
	return advisor.DatasourceCheckKind()
}
