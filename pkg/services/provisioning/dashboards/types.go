package dashboards

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type DashboardsAsConfig struct {
	Name     string                 `json:"name" yaml:"name"`
	Type     string                 `json:"type" yaml:"type"`
	OrgId    int64                  `json:"org_id" yaml:"org_id"`
	Folder   string                 `json:"folder" yaml:"folder"`
	Editable bool                   `json:"editable" yaml:"editable"`
	Options  map[string]interface{} `json:"options" yaml:"options"`
}

type dashboardCache struct {
	mutex      *sync.Mutex
	dashboards map[string]*dashboards.SaveDashboardItem
}

func newDashboardCache() *dashboardCache {
	return &dashboardCache{
		dashboards: map[string]*dashboards.SaveDashboardItem{},
		mutex:      &sync.Mutex{},
	}
}

func (dc *dashboardCache) addCache(key string, json *dashboards.SaveDashboardItem) {
	dc.mutex.Lock()
	defer dc.mutex.Unlock()
	dc.dashboards[key] = json
}

func (dc *dashboardCache) getCache(key string) (*dashboards.SaveDashboardItem, bool) {
	dc.mutex.Lock()
	defer dc.mutex.Unlock()
	v, exist := dc.dashboards[key]
	return v, exist
}

func createDashboardJson(data *simplejson.Json, lastModified time.Time, cfg *DashboardsAsConfig) (*dashboards.SaveDashboardItem, error) {

	dash := &dashboards.SaveDashboardItem{}
	dash.Dashboard = models.NewDashboardFromJson(data)
	dash.TitleLower = strings.ToLower(dash.Dashboard.Title)
	dash.ModTime = lastModified
	dash.OrgId = cfg.OrgId
	dash.Folder = cfg.Folder
	dash.Dashboard.Data.Set("editable", cfg.Editable)

	if dash.Dashboard.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	return dash, nil
}
