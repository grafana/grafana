package api

type accountInfoDto struct {
	Login         string                 `json:"login"`
	Email         string                 `json:"email"`
	AccountName   string                 `json:"accountName"`
	Collaborators []*collaboratorInfoDto `json:"collaborators"`
}

type collaboratorInfoDto struct {
	AccountId int    `json:"accountId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
}

type addCollaboratorDto struct {
	Email string `json:"email" binding:"required"`
}
