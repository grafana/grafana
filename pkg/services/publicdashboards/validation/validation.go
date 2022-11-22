package validation

import (
	"github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

func ValidatePublicDashboard(dto *SavePublicDashboardDTO, dashboard *models.Dashboard) error {
	if hasTemplateVariables(dashboard) {
		return ErrPublicDashboardHasTemplateVariables.Errorf("ValidateSavePublicDashboard: public dashboard has template variables")
	}

	return nil
}

func hasTemplateVariables(dashboard *models.Dashboard) bool {
	templateVariables := dashboard.Data.Get("templating").Get("list").MustArray()

	return len(templateVariables) > 0
}

func ValidateQueryPublicDashboardRequest(req PublicDashboardQueryDTO) error {
	if req.IntervalMs < 0 {
		return ErrInvalidInterval.Errorf("ValidateQueryPublicDashboardRequest: intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return ErrInvalidMaxDataPoints.Errorf("ValidateQueryPublicDashboardRequest: maxDataPoints should be greater than 0")
	}

	return nil
}
