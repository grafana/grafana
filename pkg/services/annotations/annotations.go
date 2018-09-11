package annotations

import "github.com/grafana/grafana/pkg/components/simplejson"

type Repository interface {
	Save(item *Item) error
	Update(item *Item) error
	Find(query *ItemQuery) ([]*ItemDTO, error)
	Delete(params *DeleteParams) error
}

type ItemQuery struct {
	OrgId        int64    `json:"orgId"`
	From         int64    `json:"from"`
	To           int64    `json:"to"`
	UserId       int64    `json:"userId"`
	AlertId      int64    `json:"alertId"`
	DashboardId  int64    `json:"dashboardId"`
	PanelId      int64    `json:"panelId"`
	AnnotationId int64    `json:"annotationId"`
	RegionId     int64    `json:"regionId"`
	Tags         []string `json:"tags"`
	Type         string   `json:"type"`

	Limit int64 `json:"limit"`
}

type PostParams struct {
	DashboardId int64  `json:"dashboardId"`
	PanelId     int64  `json:"panelId"`
	Epoch       int64  `json:"epoch"`
	Title       string `json:"title"`
	Text        string `json:"text"`
	Icon        string `json:"icon"`
}

type DeleteParams struct {
	OrgId       int64
	Id          int64
	AlertId     int64
	DashboardId int64
	PanelId     int64
	RegionId    int64
}

var repositoryInstance Repository

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type Item struct {
	Id          int64            `json:"id"`
	OrgId       int64            `json:"orgId"`
	UserId      int64            `json:"userId"`
	DashboardId int64            `json:"dashboardId"`
	PanelId     int64            `json:"panelId"`
	RegionId    int64            `json:"regionId"`
	Text        string           `json:"text"`
	AlertId     int64            `json:"alertId"`
	PrevState   string           `json:"prevState"`
	NewState    string           `json:"newState"`
	Epoch       int64            `json:"epoch"`
	Created     int64            `json:"created"`
	Updated     int64            `json:"updated"`
	Tags        []string         `json:"tags"`
	Data        *simplejson.Json `json:"data"`

	// needed until we remove it from db
	Type  string
	Title string
}

type ItemDTO struct {
	Id          int64            `json:"id"`
	AlertId     int64            `json:"alertId"`
	AlertName   string           `json:"alertName"`
	DashboardId int64            `json:"dashboardId"`
	PanelId     int64            `json:"panelId"`
	UserId      int64            `json:"userId"`
	NewState    string           `json:"newState"`
	PrevState   string           `json:"prevState"`
	Created     int64            `json:"created"`
	Updated     int64            `json:"updated"`
	Time        int64            `json:"time"`
	Text        string           `json:"text"`
	RegionId    int64            `json:"regionId"`
	Tags        []string         `json:"tags"`
	Login       string           `json:"login"`
	Email       string           `json:"email"`
	AvatarUrl   string           `json:"avatarUrl"`
	Data        *simplejson.Json `json:"data"`
}
