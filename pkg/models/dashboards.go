package models

import (
	"encoding/json"
	"io"
	"time"
)

type Dashboard struct {
	Id                   string `gorethink:"id,omitempty"`
	AccountId            string
	LastModifiedByUserId string
	LastModifiedByDate   time.Time
	CreatedDate          time.Time

	Title string
	Tags  []string
	Data  map[string]interface{}
}

type UserContext struct {
	UserId    string
	AccountId string
}

type SearchResult struct {
	Id    string `json:"id"`
	Title string `json:"title"`
}

func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Id = ""
	dash.AccountId = "test"
	dash.LastModifiedByDate = time.Now()
	dash.CreatedDate = time.Now()
	dash.LastModifiedByUserId = "123"
	dash.Title = title
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

	dash.Title = dash.Data["title"].(string)

	return dash, nil
}

func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}
