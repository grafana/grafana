package validation

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func ValidatePublicDashboard(dto *SavePublicDashboardDTO, dashboard *dashboards.Dashboard) error {
	if hasTemplateVariables(dashboard) {
		return ErrPublicDashboardHasTemplateVariables.Errorf("ValidateSavePublicDashboard: public dashboard has template variables")
	}

	return nil
}

func hasTemplateVariables(dashboard *dashboards.Dashboard) bool {
	templateVariables := dashboard.Data.Get("templating").Get("list").MustArray()

	return len(templateVariables) > 0
}

func ValidateQueryPublicDashboardRequest(req PublicDashboardQueryDTO, pd *PublicDashboard) error {
	if req.IntervalMs < 0 {
		return ErrInvalidInterval.Errorf("ValidateQueryPublicDashboardRequest: intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return ErrInvalidMaxDataPoints.Errorf("ValidateQueryPublicDashboardRequest: maxDataPoints should be greater than 0")
	}

	if pd.TimeSelectionEnabled {
		timeRange := legacydata.NewDataTimeRange(req.TimeRange.From, req.TimeRange.To)

		_, err := timeRange.ParseFrom()
		if err != nil {
			return ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range from is invalid")
		}
		_, err = timeRange.ParseTo()
		if err != nil {
			return ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range to is invalid")
		}
	}

	return nil
}
