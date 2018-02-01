package dashboards

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"

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

func createDashboardJson(data *simplejson.Json, lastModified time.Time, cfg *DashboardsAsConfig, folderId int64) (*dashboards.SaveDashboardItem, error) {
	dash := &dashboards.SaveDashboardItem{}
	dash.Dashboard = models.NewDashboardFromJson(data)
	dash.UpdatedAt = lastModified
	dash.Overwrite = true
	dash.OrgId = cfg.OrgId
	dash.Dashboard.OrgId = cfg.OrgId
	dash.Dashboard.FolderId = folderId
	if !cfg.Editable {
		dash.Dashboard.Data.Set("editable", cfg.Editable)
	}

	if dash.Dashboard.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	return dash, nil
}
