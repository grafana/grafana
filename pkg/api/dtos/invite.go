package dtos

import "github.com/grafana/grafana/pkg/models"

type AddInviteForm struct {
	LoginOrEmail string          `json:"loginOrEmail" binding:"Required"`
	Name         string          `json:"name"`
	Role         models.RoleType `json:"role" binding:"Required"`
	SendEmail    bool            `json:"sendEmail"`
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
