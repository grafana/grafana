package validation

import (
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
