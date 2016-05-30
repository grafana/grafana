package dtos

type AlertRuleDTO struct {
	Id           int64  `json:"id"`
	DashboardId  int64  `json:"dashboardId"`
	PanelId      int64  `json:"panelId"`
	Query        string `json:"query"`
	QueryRefId   string `json:"queryRefId"`
	WarnLevel    int64  `json:"warnLevel"`
	CritLevel    int64  `json:"critLevel"`
	WarnOperator string `json:"warnOperator"`
	CritOperator string `json:"critOperator"`
	Frequency    int64  `json:"frequency"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	QueryRange   int    `json:"queryRange"`
	Aggregator   string `json:"aggregator"`
	State        string `json:"state"`

	DashbboardUri string `json:"dashboardUri"`
}
