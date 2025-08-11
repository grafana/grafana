package datasourcecheck

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type healthCheckStep struct {
	PluginContextProvider pluginContextProvider
	PluginClient          plugins.Client
}

func (s *healthCheckStep) Title() string {
	return "Health check"
}

func (s *healthCheckStep) Description() string {
	return "Checks if a data source is healthy."
}

func (s *healthCheckStep) Resolution() string {
	return "Go to the data source configuration page and address the issues reported."
}

func (s *healthCheckStep) ID() string {
	return HealthCheckStepID
}

func (s *healthCheckStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
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
	if err != nil || (resp != nil && resp.Status != backend.HealthStatusOk) {
		if err != nil {
			log.Debug("Failed to check health", "datasource_uid", ds.UID, "error", err)
			if errors.Is(err, plugins.ErrMethodNotImplemented) || errors.Is(err, plugins.ErrPluginUnavailable) {
				// The plugin does not support backend health checks
				return nil, nil
			}
		} else {
			log.Debug("Failed to check health", "datasource_uid", ds.UID, "status", resp.Status, "message", resp.Message)
		}
		moreInfo := ""
		if resp != nil {
			moreInfo = fmt.Sprintf("Status: %s\nMessage: %s\nJSONDetails: %s", resp.Status, resp.Message, resp.JSONDetails)
		}
		return []advisor.CheckReportFailure{checks.NewCheckReportFailureWithMoreInfo(
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
			moreInfo,
		)}, nil
	}
	return nil, nil
}
