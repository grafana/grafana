package dtos

import "github.com/grafana/grafana/pkg/models"

type UpdateDashboardAclCommand struct {
	Items []DashboardAclUpdateItem `json:"items"`
}

type DashboardAclUpdateItem struct {
	UserID     int64                 `json:"userId"`
	TeamID     int64                 `json:"teamId"`
	Role       *models.RoleType      `json:"role,omitempty"`
	Permission models.PermissionType `json:"permission"`
}
