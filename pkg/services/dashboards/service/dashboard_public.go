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
	pubdash, d, err := dr.dashboardStore.GetPublicDashboard(dashboardUid)

	if err != nil {
		return nil, err
	}

	if pubdash == nil || d == nil {
		return nil, models.ErrPublicDashboardNotFound
	}

	if !pubdash.IsEnabled {
		return nil, models.ErrPublicDashboardNotFound
	}

	// Replace dashboard time range with pubdash time range
	if pubdash.TimeSettings != "" {
		var pdTimeSettings map[string]interface{}
		err = json.Unmarshal([]byte(pubdash.TimeSettings), &pdTimeSettings)
		if err != nil {
			return nil, err
		}

		d.Data.Set("time", pdTimeSettings)
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

	pubdash, err := dr.dashboardStore.SavePublicDashboardConfig(cmd)
	if err != nil {
		return nil, err
	}

	return pubdash, nil
}

func (dr *DashboardServiceImpl) BuildPublicDashboardMetricRequest(ctx context.Context, publicDashboardUid string, panelId int64) (dtos.MetricRequest, error) {
	publicDashboard, dashboard, err := dr.dashboardStore.GetPublicDashboard(publicDashboardUid)
	if err != nil {
		return dtos.MetricRequest{}, err
	}

	if !publicDashboard.IsEnabled {
		return dtos.MetricRequest{}, models.ErrPublicDashboardNotFound
	}

	var timeSettings struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	err = json.Unmarshal([]byte(publicDashboard.TimeSettings), &timeSettings)
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
