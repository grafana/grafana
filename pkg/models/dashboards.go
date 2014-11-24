package models

import (
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"strings"
	"time"
)

var (
	GetDashboard    func(slug string, accountId int64) (*Dashboard, error)
	SaveDashboard   func(dash *Dashboard) error
	DeleteDashboard func(slug string, accountId int64) error
	SearchQuery     func(query string, acccountId int64) ([]*SearchResult, error)
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

func NewDashboard(title string) *Dashboard {
	dash := &Dashboard{}
	dash.Id = 0
	dash.Data = make(map[string]interface{})
	dash.Data["title"] = title
	dash.Title = title
	dash.UpdateSlug()

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

func (dash *Dashboard) GetString(prop string) string {
	return dash.Data[prop].(string)
}

func (dash *Dashboard) UpdateSlug() {
	title := strings.ToLower(dash.Data["title"].(string))
	re := regexp.MustCompile("[^\\w ]+")
	re2 := regexp.MustCompile("\\s")
	dash.Slug = re2.ReplaceAllString(re.ReplaceAllString(title, ""), "-")
}
