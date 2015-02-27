package dtos

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
	IsGrafanaAdmin bool `json:"IsGrafanaAdmin" binding:"Required"`
}
