package api

type saveDashboardCommand struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Dashboard map[string]interface{}
}

type errorResponse struct {
	Message string `json:"message"`
}

type IndexDto struct {
	User CurrentUserDto
}

type CurrentUserDto struct {
	Login string `json:"login"`
}

type LoginResultDto struct {
	Status string         `json:"status"`
	User   CurrentUserDto `json:"user"`
}

func newErrorResponse(message string) *errorResponse {
	return &errorResponse{Message: message}
}
