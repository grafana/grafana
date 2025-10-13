package dtos

import "github.com/grafana/grafana/pkg/services/user"

type SignUpForm struct {
	Email string `json:"email" binding:"Required"`
}

type SignUpStep2Form struct {
	Email    string        `json:"email"`
	Name     string        `json:"name"`
	Username string        `json:"username"`
	Password user.Password `json:"password"`
	Code     string        `json:"code"`
	OrgName  string        `json:"orgName"`
}

type AdminCreateUserForm struct {
	Email    string        `json:"email"`
	Login    string        `json:"login"`
	Name     string        `json:"name"`
	Password user.Password `json:"password" binding:"Required"`
	OrgId    int64         `json:"orgId"`
}

type AdminUpdateUserPasswordForm struct {
	Password user.Password `json:"password" binding:"Required"`
}

type AdminUpdateUserPermissionsForm struct {
	IsGrafanaAdmin bool `json:"isGrafanaAdmin"`
}

type SendResetPasswordEmailForm struct {
	UserOrEmail string `json:"userOrEmail" binding:"Required"`
}

type ResetUserPasswordForm struct {
	Code            string        `json:"code"`
	NewPassword     user.Password `json:"newPassword"`
	ConfirmPassword user.Password `json:"confirmPassword"`
}

type UserLookupDTO struct {
	UserID    int64  `json:"userId"`
	UID       string `json:"uid"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}
