package annotations

import "github.com/grafana/grafana/pkg/components/simplejson"

type Repository interface {
	Save(item *Item) error
	Update(item *Item) error
	Find(query *ItemQuery) ([]*Item, error)
	Delete(params *DeleteParams) error
}

type ItemQuery struct {
	OrgId       int64    `json:"orgId"`
	From        int64    `json:"from"`
	To          int64    `json:"to"`
	Type        ItemType `json:"type"`
	AlertId     int64    `json:"alertId"`
	DashboardId int64    `json:"dashboardId"`
	PanelId     int64    `json:"panelId"`
	NewState    []string `json:"newState"`

	Limit int64 `json:"limit"`
}

type PostParams struct {
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	Epoch       int64  `json:"epoch"`
	Title       string `json:"title"`
	Text        string `json:"text"`
}

type DeleteParams struct {
	AlertId     int64 `json:"alertId"`
	DashboardId int64 `json:"dashboardId"`
	PanelId     int64 `json:"panelId"`
}

var repositoryInstance Repository

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type ItemType string

const (
	AlertType ItemType = "alert"
	EventType ItemType = "event"
)

type Item struct {
	Id          int64    `json:"id"`
	OrgId       int64    `json:"orgId"`
	DashboardId int64    `json:"dashboardId"`
	PanelId     int64    `json:"panelId"`
	CategoryId  int64    `json:"categoryId"`
	RegionId    int64    `json:"regionId"`
	Type        ItemType `json:"type"`
	Title       string   `json:"title"`
	Text        string   `json:"text"`
	Metric      string   `json:"metric"`
	AlertId     int64    `json:"alertId"`
	UserId      int64    `json:"userId"`
	PrevState   string   `json:"prevState"`
	NewState    string   `json:"newState"`
	Epoch       int64    `json:"epoch"`

	Data *simplejson.Json `json:"data"`
}
