package validation

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	publicDashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

func ValidateSavePublicDashboard(dto *publicDashboardModels.SavePublicDashboardConfigDTO, dashboard *models.Dashboard) error {
	if hasTemplateVariables(dashboard) {
		return publicDashboardModels.ErrPublicDashboardHasTemplateVariables
	}

	return nil
}

func hasTemplateVariables(dashboard *models.Dashboard) bool {
	templateVariables := dashboard.Data.Get("templating").Get("list").MustArray()

	return len(templateVariables) > 0
}

func ValidateQueryPublicDashboardRequest(req publicDashboardModels.PublicDashboardQueryDTO) error {
	if req.IntervalMs < 0 {
		return fmt.Errorf("intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return fmt.Errorf("maxDataPoints should be greater than 0")
	}

	return nil
}
