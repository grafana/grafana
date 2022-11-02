package validation

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

func ValidateSavePublicDashboard(dto *SavePublicDashboardDTO, dashboard *models.Dashboard) error {
	if hasTemplateVariables(dashboard) {
		return ErrPublicDashboardHasTemplateVariables
	}

	return nil
}

func hasTemplateVariables(dashboard *models.Dashboard) bool {
	templateVariables := dashboard.Data.Get("templating").Get("list").MustArray()

	return len(templateVariables) > 0
}

func ValidateQueryPublicDashboardRequest(req PublicDashboardQueryDTO) error {
	if req.IntervalMs < 0 {
		return fmt.Errorf("intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return fmt.Errorf("maxDataPoints should be greater than 0")
	}

	return nil
}
