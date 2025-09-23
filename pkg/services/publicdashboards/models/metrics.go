package models

type TotalPublicDashboard struct {
	TotalCount float64
	IsEnabled  bool
	ShareType  string
}

type Metrics struct {
	TotalPublicDashboards []*TotalPublicDashboard
}
