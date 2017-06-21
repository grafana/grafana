package dtos

import (
	m "github.com/grafana/grafana/pkg/models"
)

type UpdateDashboardAclCommand struct {
	Items []DashboardAclUpdateItem `json:"items"`
}

type DashboardAclUpdateItem struct {
	UserId      int64            `json:"userId"`
	UserGroupId int64            `json:"userGroupId"`
	Role        m.RoleType       `json:"role"`
	Permission  m.PermissionType `json:"permission"`
}
