package dtos

import m "github.com/grafana/grafana/pkg/models"

type AddInviteForm struct {
	Email      string     `json:"email" binding:"Required"`
	Name       string     `json:"name"`
	Role       m.RoleType `json:"role" binding:"Required"`
	SkipEmails bool       `json:"skipEmails"`
}

type InviteInfo struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	Username  string `json:"username"`
	InvitedBy string `json:"invitedBy"`
}

type CompleteInviteForm struct {
	InviteCode      string `json:"inviteCode"`
	Email           string `json:"email" binding:"Required"`
	Name            string `json:"name"`
	Username        string `json:"username"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}
