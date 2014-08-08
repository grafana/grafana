package httpApi

type saveDashboardCommand struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Dashboard map[string]interface{}
}
