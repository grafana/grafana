package api

type saveDashboardCommand struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Dashboard map[string]interface{}
}

type errorResponse struct {
	Message string `json:"message"`
}

type indexViewModel struct {
	title string
}

func newErrorResponse(message string) *errorResponse {
	return &errorResponse{Message: message}
}
