package models

import (
	"encoding/json"
	"io"
)

type Dashboard struct {
	Data map[string]interface{}
}

type SearchResult struct {
	Type  string `json:"title"`
	Id    string `json:"id"`
	Title string `json:"title"`
}

func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Data = make(map[string]interface{})
	dash.Data["title"] = title

	return dash
}

func NewFromJson(reader io.Reader) (*Dashboard, error) {
	dash := NewDashboard("temp")
	jsonParser := json.NewDecoder(reader)

	if err := jsonParser.Decode(&dash.Data); err != nil {
		return nil, err
	}

	return dash, nil
}

/*type DashboardServices struct {
}

type DashboardServicesFilter struct {
}

type DashboardServicesFilterTime struct {
	From string 	To	string
}*/

func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}

func (dash *Dashboard) Title() string {
	return dash.GetString("title")
}
