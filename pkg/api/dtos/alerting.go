package dtos

type AlertRuleDTO struct {
	Id          int64  `json:"id"`
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	Query       string `json:"query"`
	QueryRefId  string `json:"queryRefId"`
	WarnLevel   string `json:"warnLevel"`
	CritLevel   string `json:"critLevel"`
	Interval    string `json:"interval"`
	Title       string `json:"title"`
	Description string `json:"description"`
	QueryRange  string `json:"queryRange"`
	Aggregator  string `json:"aggregator"`
	State       string `json:"state"`

	DashbboardUri string `json:"dashboardUri"`
}
