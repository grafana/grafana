package import_export_plugin

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type GetDashQuery struct {
	FolderUIds    []string
	DashboardUIds []string
	Result        []*dashboards.Dashboard
}

type Datasource struct {
	Name     string `xorm:"name"`
	UID      string `xorm:"uid"`
	PluginID string `xorm:"type"`
}

type GetDSQuery struct {
	UID    []string
	Result []*Datasource
}
