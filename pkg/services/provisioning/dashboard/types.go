package dashboard

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type DashboardsAsConfig struct {
	Name    string                 `json:"name" yaml:"name"`
	Type    string                 `json:"type" yaml:"type"`
	OrgId   int64                  `json:"org_id" yaml:"org_id"`
	Folder  string                 `json:"folder" yaml:"folder"`
	Options map[string]interface{} `json:"options" yaml:"options"`
}

type DashboardJson struct {
	TitleLower string
	Path       string
	OrgId      int64
	Folder     string
	ModTime    time.Time
	Dashboard  *models.Dashboard
}

type DashboardIndex struct {
	mutex *sync.Mutex

	PathToDashboard map[string]*DashboardJson
}

type InsertDashboard func(cmd *models.Dashboard) error
type UpdateDashboard func(cmd *models.SaveDashboardCommand) error
