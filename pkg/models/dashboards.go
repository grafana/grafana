package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrDashboardNotFound = errors.New("Account not found")
)

type Dashboard struct {
	Id        int64
	Slug      string `xorm:"index(IX_AccountIdSlug)"`
	AccountId int64  `xorm:"index(IX_AccountIdSlug)"`

	Created time.Time `xorm:"CREATED"`
	Updated time.Time `xorm:"UPDATED"`

	Title string
	Tags  []string
	Data  map[string]interface{}
}

type SearchResult struct {
	Id    string `json:"id"`
	Title string `json:"title"`
	Slug  string `json:"slug"`
}

type SearchDashboardsQuery struct {
	Query     string
	AccountId int64

	Result []*SearchResult
}

type SaveDashboardCommand struct {
	Id        string                 `json:"id"`
	Title     string                 `json:"title"`
	Dashboard map[string]interface{} `json:"dashboard"`
	AccountId int64                  `json:"-"`

	Result *Dashboard
}

type DeleteDashboardCommand struct {
	Slug      string
	AccountId int64
}

type GetDashboardQuery struct {
	Slug      string
	AccountId int64

	Result *Dashboard
}

func convertToStringArray(arr []interface{}) []string {
	b := make([]string, len(arr))
	for i := range arr {
		b[i] = arr[i].(string)
	}

	return b
}

func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Data = make(map[string]interface{})
	dash.Data["title"] = title
	dash.Title = title
	dash.UpdateSlug()
	return dash
}

func (cmd *SaveDashboardCommand) GetDashboardModel() *Dashboard {
	dash := &Dashboard{}
	dash.Data = cmd.Dashboard
	dash.Title = dash.Data["title"].(string)
	dash.AccountId = cmd.AccountId
	dash.Tags = convertToStringArray(dash.Data["tags"].([]interface{}))
	dash.UpdateSlug()

	if dash.Data["id"] != nil {
		dash.Id = int64(dash.Data["id"].(float64))
	}

	return dash
}

func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}

func (dash *Dashboard) UpdateSlug() {
	title := strings.ToLower(dash.Data["title"].(string))
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	dash.Slug = re2.ReplaceAllString(re.ReplaceAllString(title, ""), "-")
}
