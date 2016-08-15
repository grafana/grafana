package annotations

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type Repository interface {
	Save(item *Item) error
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
)

type Item struct {
	Id        int64     `json:"id"`
	OrgId     int64     `json:"orgId"`
	Type      ItemType  `json:"type"`
	Title     string    `json:"title"`
	Text      string    `json:"text"`
	Metric    string    `json:"metric"`
	AlertId   int64     `json:"alertId"`
	UserId    int64     `json:"userId"`
	PrevState string    `json:"prevState"`
	NewState  string    `json:"newState"`
	Timestamp time.Time `json:"timestamp"`

	Data *simplejson.Json `json:"data"`
}
