package service

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// Gets public dashboard via generated Uid
func (dr *DashboardServiceImpl) GetPublicDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error) {
	pdc, d, err := dr.dashboardStore.GetPublicDashboard(dashboardUid)

	if err != nil {
		return nil, err
	}

	if pdc == nil || d == nil {
		return nil, models.ErrPublicDashboardNotFound
	}

	if !pdc.IsEnabled {
		return nil, models.ErrPublicDashboardNotFound
	}

	// Replace dashboard time range with pubdash time range
	if pdc.TimeSettings != "" {
		var pdcTimeSettings map[string]interface{}
		err = json.Unmarshal([]byte(pdc.TimeSettings), &pdcTimeSettings)
		if err != nil {
			return nil, err
		}

		d.Data.Set("time", pdcTimeSettings)
	}

	return d, nil
}

// GetPublicDashboardConfig is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (dr *DashboardServiceImpl) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*models.PublicDashboard, error) {
	pdc, err := dr.dashboardStore.GetPublicDashboardConfig(orgId, dashboardUid)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}

// SavePublicDashboardConfig is a helper method to persist the sharing config
// to the database. It handles validations for sharing config and persistence
func (dr *DashboardServiceImpl) SavePublicDashboardConfig(ctx context.Context, dto *dashboards.SavePublicDashboardConfigDTO) (*models.PublicDashboard, error) {
	cmd := models.SavePublicDashboardConfigCommand{
		DashboardUid:    dto.DashboardUid,
		OrgId:           dto.OrgId,
		PublicDashboard: *dto.PublicDashboard,
	}

	// Eventually we want this to propagate to array of public dashboards
	cmd.PublicDashboard.OrgId = dto.OrgId
	cmd.PublicDashboard.DashboardUid = dto.DashboardUid

	pdc, err := dr.dashboardStore.SavePublicDashboardConfig(cmd)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}

func (dr *DashboardServiceImpl) BuildPublicDashboardMetricRequest(ctx context.Context, publicDashboardUid string, panelId int64) (dtos.MetricRequest, error) {
	publicDashboardConfig, dashboard, err := dr.dashboardStore.GetPublicDashboard(publicDashboardUid)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	if !dashboard.IsPublic {
		return dtos.MetricRequest{}, models.ErrPublicDashboardNotFound
	}

	var timeSettings struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	err = json.Unmarshal([]byte(publicDashboardConfig.TimeSettings), &timeSettings)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	queriesByPanel := models.GetQueriesFromDashboard(dashboard.Data)

	if _, ok := queriesByPanel[panelId]; !ok {
		return dtos.MetricRequest{}, models.ErrPublicDashboardPanelNotFound
	}

	return dtos.MetricRequest{
		From:    timeSettings.From,
		To:      timeSettings.To,
		Queries: queriesByPanel[panelId],
	}, nil
}
