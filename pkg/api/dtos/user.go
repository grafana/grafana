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
