package service

import (
	"context"

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

	if !d.IsPublic {
		return nil, models.ErrPublicDashboardNotFound
	}

	// FIXME insert logic to substitute pdc.TimeSettings into d

	return d, nil
}

// GetPublicDashboardConfig is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (dr *DashboardServiceImpl) GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*models.PublicDashboardConfig, error) {
	pdc, err := dr.dashboardStore.GetPublicDashboardConfig(orgId, dashboardUid)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}

// SavePublicDashboardConfig is a helper method to persist the sharing config
// to the database. It handles validations for sharing config and persistence
func (dr *DashboardServiceImpl) SavePublicDashboardConfig(ctx context.Context, dto *dashboards.SavePublicDashboardConfigDTO) (*models.PublicDashboardConfig, error) {
	cmd := models.SavePublicDashboardConfigCommand{
		DashboardUid:          dto.DashboardUid,
		OrgId:                 dto.OrgId,
		PublicDashboardConfig: *dto.PublicDashboardConfig,
	}

	// Eventually we want this to propagate to array of public dashboards
	cmd.PublicDashboardConfig.PublicDashboard.OrgId = dto.OrgId
	cmd.PublicDashboardConfig.PublicDashboard.DashboardUid = dto.DashboardUid

	pdc, err := dr.dashboardStore.SavePublicDashboardConfig(cmd)
	if err != nil {
		return nil, err
	}

	return pdc, nil
}
