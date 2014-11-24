package dtos

type AddCollaboratorCommand struct {
	Email string `json:"email" binding:"required"`
}

type SaveDashboardCommand struct {
	Id        string                 `json:"id"`
	Title     string                 `json:"title"`
	Dashboard map[string]interface{} `json:"dashboard"`
}
