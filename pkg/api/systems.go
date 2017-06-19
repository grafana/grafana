package api

import (
  "github.com/wangy1931/grafana/pkg/api/dtos"
  "github.com/wangy1931/grafana/pkg/bus"
  "github.com/wangy1931/grafana/pkg/middleware"
  m "github.com/wangy1931/grafana/pkg/models"
  "strconv"
)

func UpdateSystems(c *middleware.Context, systems dtos.UpdateSystems) Response {
  if err := bus.Dispatch(&systems); err != nil {
    return ApiError(500, "Failed to update Systems", err)
  }

  return ApiSuccess("Systems updated")
}


func AddNewSystems(c *middleware.Context, system m.AddSystemsCommand) Response {
  system.OrgId = c.OrgId
  if err := bus.Dispatch(&system); err != nil {
    return ApiError(500, "Failed to update Systems", err)
  }
  return ApiSuccess("Systems added")
}

func AddOrUpdateSystemDashbord(c *middleware.Context, system_dash m.AddSystemDashboardCommand) Response {
  if err := bus.Dispatch(&system_dash); err != nil {
    return ApiError(500, "Failed to add Systems", err)
  }
  return ApiSuccess("Systems added")
}

func GetSystemsForCurrentOrg(c *middleware.Context) Response {
  query := m.GetOrgSystemsQuery{OrgId:c.OrgId}
  if err := bus.Dispatch(&query); err != nil {
    return ApiError(500, "Failed to get Systems", err)
  }
  return Json(200, query.Result)
}

func GetCurrentUserSystem(c *middleware.Context) Response {
  if(c.OrgRole=="Admin" || c.IsGrafanaAdmin) {
    return GetSystemsForCurrentOrg(c)
  }
  query := m.GetUserSystemsQuery{UserId: c.UserId}
  if err := bus.Dispatch(&query); err != nil {
    return ApiError(500, "Failed to get Systems", err)
  }
  return Json(200, query.Result)
}

func GetCurrentUserSystemFromIndex(c *middleware.Context) (interface{}, error) {
  query := m.GetOrgSystemsQuery{OrgId:c.OrgId}
  if err := bus.Dispatch(&query); err != nil {
    return nil, err
  }
  return query.Result, nil
}

func AddOrUpdatePickSystem(c *middleware.Context, system_pick m.AddOrUpdateSystemPick) Response {
  system_pick.UserId = strconv.FormatInt(c.UserId, 10);
  if err := bus.Dispatch(&system_pick); err != nil {
    return ApiError(500, "Failed to update or add pickup system", err)
  }
  return ApiSuccess("picked system")
}