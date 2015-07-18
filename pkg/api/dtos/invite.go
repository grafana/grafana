package dtos

import m "github.com/grafana/grafana/pkg/models"

type AddInviteForm struct {
	Email      string     `json:"email" binding:"Required"`
	Name       string     `json:"name"`
	Role       m.RoleType `json:"role" binding:"Required"`
	SkipEmails bool       `json:"skipEmails"`
}
