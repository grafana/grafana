package bhd_external

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type Dashboard struct {
	UID         string `xorm:"uid" json:"uid"`
	Title       string
	Tags        string
	FolderID    int64 `xorm:"folder_id" json:"folder_id"`
	FolderTitle string
	Created     time.Time
	Updated     time.Time
	UpdatedBy   int64
	CreatedBy   int64
}

type DashboardById struct {
	UID   string `xorm:"uid" json:"uid"`
	Title string
	Data  *simplejson.Json
}

type DashboardBodyParams struct {
	FolderName string   `json:"folderName"`
	Tags       []string `json:"tags"`
}

type Variable struct {
	Name       string `json:"name"`
	Label      string `json:"label"`
	Query      string `json:"query"`
	Datasource string `json:"datasource"`
	Type       string `json:"type"`
	QueryType  string `json:"queryType"`
	IncludeAll bool   `json:"includeAll"`
	Multi      bool   `json:"multi"`
	StatusCode int    `json:"statusCode"`
}

type DashboardbyId struct {
	Title         string     `json:"title"`
	UID           string     `json:"uid"`
	VariableList  []Variable `json:"variableList"`
	VariableCount int        `json:"count"`
}

type Result struct {
	StatusCode    int           `json:"statusCode"`
	StatusMessage string        `json:"statusMessage"`
	Response      DashboardbyId `json:"dashboard"`
}
