package zanzana

import (
	dashboardalpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

const (
	roleGrafanaAdmin = "Grafana Admin"
	roleAdmin        = "Admin"
	roleEditor       = "Editor"
	roleViewer       = "Viewer"
	roleNone         = "None"
)

var basicRolesTranslations = map[string]string{
	roleGrafanaAdmin: "basic_grafana_admin",
	roleAdmin:        "basic_admin",
	roleEditor:       "basic_editor",
	roleViewer:       "basic_viewer",
	roleNone:         "basic_none",
}

type resourceTranslation struct {
	typ      string
	group    string
	resource string
	mapping  map[string]actionMappig
}

type actionMappig struct {
	relation    string
	group       string
	resource    string
	subresource string
}

func newMapping(relation, subresource string) actionMappig {
	return newScopedMapping(relation, "", "", subresource)
}

func newScopedMapping(relation, group, resource, subresource string) actionMappig {
	return actionMappig{relation, group, resource, subresource}
}

var (
	folderGroup    = folderalpha1.FolderResourceInfo.GroupResource().Group
	folderResource = folderalpha1.FolderResourceInfo.GroupResource().Resource

	dashboardGroup    = dashboardalpha1.DashboardResourceInfo.GroupResource().Group
	dashboardResource = dashboardalpha1.DashboardResourceInfo.GroupResource().Resource
)

var resourceTranslations = map[string]resourceTranslation{
	KindFolders: {
		typ:      TypeFolder,
		group:    folderGroup,
		resource: folderResource,
		mapping: map[string]actionMappig{
			"folders:read":      newMapping(RelationGet, ""),
			"folders:write":     newMapping(RelationUpdate, ""),
			"folders:create":    newMapping(RelationCreate, ""),
			"folders:delete":    newMapping(RelationDelete, ""),
			"dashboards:read":   newScopedMapping(RelationGet, dashboardGroup, dashboardResource, ""),
			"dashboards:write":  newScopedMapping(RelationUpdate, dashboardGroup, dashboardResource, ""),
			"dashboards:create": newScopedMapping(RelationCreate, dashboardGroup, dashboardResource, ""),
			"dashboards:delete": newScopedMapping(RelationDelete, dashboardGroup, dashboardResource, ""),
		},
	},
	KindDashboards: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: dashboardResource,
		mapping: map[string]actionMappig{
			"dashboards:read":   newMapping(RelationGet, ""),
			"dashboards:write":  newMapping(RelationUpdate, ""),
			"dashboards:create": newMapping(RelationCreate, ""),
			"dashboards:delete": newMapping(RelationDelete, ""),
		},
	},
}
