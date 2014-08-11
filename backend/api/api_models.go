package api

type saveDashboardCommand struct {
	id        string `json:"id"`
	title     string `json:"title"`
	dashboard map[string]interface{}
}

type errorResponse struct {
	message string `json:"message"`
}

type indexViewModel struct {
	title string
}

func newErrorResponse(message string) *errorResponse {
	return &errorResponse{message: message}
}
