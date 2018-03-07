package model

import (
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
)

type DashboardProcessor func(dashboard *models.Dashboard)

func getDashboards() ([]*models.Dashboard, bool) {
  query := models.GetAllDashboardsQuery {}
  err := bus.Dispatch(&query)

  return query.Result, (err == nil)
}

func UpdateDashboard(dashboard *models.Dashboard) (bool) {

  updateCommand := models.UpdateDashboardCommand {
    Dashboard: dashboard,
  }

  err := bus.Dispatch(&updateCommand)
  return (err == nil)
}

func ProcessDashboards(dashboardProcessor DashboardProcessor) {
  dashboards, dashboardsFound := getDashboards()
  if dashboardsFound {
    for dashboardIndex := range dashboards {
      dashboardProcessor(dashboards[dashboardIndex])
    }
  }
}
