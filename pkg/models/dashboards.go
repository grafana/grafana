package models

import (
	"errors"
	"regexp"
	"strings"
	"time"
)

// Typed errors
var (
	ErrDashboardNotFound           = errors.New("Account not found")
	ErrDashboardWithSameNameExists = errors.New("A dashboard with the same name already exists")
)

type Dashboard struct {
	Id        int64
	Slug      string
	AccountId int64

	Created time.Time
	Updated time.Time

	Title string
	Data  map[string]interface{}
}

func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Data = make(map[string]interface{})
	dash.Data["title"] = title
	dash.Title = title
	dash.UpdateSlug()
	return dash
}

func (dash *Dashboard) GetTags() []string {
	jsonTags := dash.Data["tags"]
	if jsonTags == nil {
		return []string{}
	}

	arr := jsonTags.([]interface{})
	b := make([]string, len(arr))
	for i := range arr {
		b[i] = arr[i].(string)
	}
	return b
}

func (cmd *SaveDashboardCommand) GetDashboardModel() *Dashboard {
	dash := &Dashboard{}
	dash.Data = cmd.Dashboard
	dash.Title = dash.Data["title"].(string)
	dash.AccountId = cmd.AccountId
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

//
// COMMANDS
//

type SaveDashboardCommand struct {
	Dashboard map[string]interface{} `json:"dashboard"`
	AccountId int64                  `json:"-"`

	Result *Dashboard
}

type DeleteDashboardCommand struct {
	Slug      string
	AccountId int64
}

//
// QUERIES
//

type GetDashboardQuery struct {
	Slug      string
	AccountId int64

	Result *Dashboard
}
