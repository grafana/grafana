package validation

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	publicDashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

func ValidateSavePublicDashboard(dto *publicDashboardModels.SavePublicDashboardConfigDTO, dashboard *models.Dashboard) error {
	var err error

	if len(dto.DashboardUid) == 0 {
		return dashboards.ErrDashboardIdentifierNotSet
	}

	if hasTemplateVariables(dashboard) {
		return publicDashboardModels.ErrPublicDashboardHasTemplateVariables
	}

	return err
}

func hasTemplateVariables(dashboard *models.Dashboard) bool {
	templateVariables := dashboard.Data.Get("templating").Get("list").MustArray()

	return len(templateVariables) > 0
}

func ValidateQueryPublicDashboardRequest(req *publicDashboardModels.PublicDashboardQueryDTO) error {
	if req.IntervalMs < 0 {
		return fmt.Errorf("intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return fmt.Errorf("maxDataPoints should be greater than 0")
	}

	return nil
}
