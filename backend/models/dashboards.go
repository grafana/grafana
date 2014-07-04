package models

import ()

type Dashboard struct {
	Data map[string]interface{}
}

/*type DashboardServices struct {
}

type DashboardServicesFilter struct {
}

type DashboardServicesFilterTime struct {
	From string `json:"title"`
	To	string
}*/

func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}

func (dash *Dashboard) Title() string {
	return dash.GetString("title")
}
