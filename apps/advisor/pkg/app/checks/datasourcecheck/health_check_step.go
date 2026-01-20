package datasourcecheck

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type healthCheckStep struct {
	HealthChecker checks.HealthChecker
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
	resp, err := s.HealthChecker.CheckHealth(ctx, ds)
	if err != nil {
		// Unable to check health check
		log.Error("Failed to get plugin context", "datasource_uid", ds.UID, "error", err)
		if errors.Is(err, plugins.ErrMethodNotImplemented) || errors.Is(err, plugins.ErrPluginUnavailable) {
			// The plugin does not support backend health checks
			return nil, nil
		}
		// For other errors (including ErrPluginNotRegistered from GetWithDataSource),
		// we skip the health check step and let the missing plugin step handle it
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			// The plugin is not installed, handle this in the missing plugin step
			return nil, nil
		}
		return nil, nil
	}
	if resp != nil && resp.Status != backend.HealthStatusOk {
		log.Debug("Failed to check health", "datasource_uid", ds.UID, "status", resp.Status, "message", resp.Message)
		moreInfo := fmt.Sprintf("Status: %s\nMessage: %s\nJSONDetails: %s", resp.Status, resp.Message, resp.JSONDetails)
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
