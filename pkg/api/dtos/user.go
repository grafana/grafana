package dtos

type SignUpForm struct {
	Email string `json:"email" binding:"Required"`
}

type SignUpStep2Form struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Code     string `json:"code"`
	OrgName  string `json:"orgName"`
}

type AdminCreateUserForm struct {
	Email    string `json:"email"`
	Login    string `json:"login"`
	Name     string `json:"name"`
	Password string `json:"password" binding:"Required"`
}

type AdminUpdateUserForm struct {
	Email string `json:"email"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

type AdminUpdateUserPasswordForm struct {
	Password string `json:"password" binding:"Required"`
}

type AdminUpdateUserPermissionsForm struct {
	IsGrafanaAdmin bool `json:"IsGrafanaAdmin"`
}

type AdminUserListItem struct {
	Email          string `json:"email"`
	Name           string `json:"name"`
	Login          string `json:"login"`
	IsGrafanaAdmin bool   `json:"isGrafanaAdmin"`
}

type SendResetPasswordEmailForm struct {
	UserOrEmail string `json:"userOrEmail" binding:"Required"`
}

type ResetUserPasswordForm struct {
	Code            string `json:"code"`
	NewPassword     string `json:"newPassword"`
	ConfirmPassword string `json:"confirmPassword"`
}
