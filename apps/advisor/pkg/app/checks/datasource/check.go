package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/klog/v2"
)

func init() {
	checks.AddFactory(&factory{})
}

type factory struct{}

func (r *factory) New(cfg *checks.AdvisorConfig) checks.Check {
	return &check{cfg}
}

type check struct {
	cfg *checks.AdvisorConfig
}

func (c *check) Type() string {
	return "datasource"
}

func (c *check) Run(ctx context.Context, obj *advisor.CheckSpec) (*advisor.CheckV0alpha1StatusReport, error) {
	// Optionally read the check input encoded in the object
	// fmt.Println(obj.Data)

	dss, err := c.cfg.DatasourceSvc.GetAllDataSources(ctx, &datasources.GetAllDataSourcesQuery{})
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
				Reason:   fmt.Sprintf("Invalid UID: %s", ds.UID),
				Action:   "Change UID",
			})
		}

		// Health check execution
		id := &user.SignedInUser{OrgID: int64(1), Login: "admin"}
		ctx = identity.WithRequester(ctx, id)
		pCtx, err := c.cfg.PluginContextProvider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
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
		resp, err := c.cfg.PluginClient.CheckHealth(ctx, req)
		if err != nil {
			fmt.Println("Error checking health", err)
			continue
		}
		if resp.Status != backend.HealthStatusOk {
			dsErrs = append(dsErrs, advisor.CheckV0alpha1StatusReportErrors{
				Severity: advisor.CheckStatusSeverityHigh,
				Reason:   fmt.Sprintf("Health check failed: %s", ds.Name),
				Action:   "Check datasource",
			})
		}
	}

	return &advisor.CheckV0alpha1StatusReport{
		Count:  int64(len(dss)),
		Errors: dsErrs,
	}, nil
}
