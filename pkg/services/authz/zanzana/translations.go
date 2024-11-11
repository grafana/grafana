package zanzana

import (
	dashboardalpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type resourceTranslation struct {
	typ      string
	group    string
	resource string
	mapping  map[string]actionMappig
}

type actionMappig struct {
	relation string
	group    string
	resource string
}

func newMapping(relation string) actionMappig {
	return newScopedMapping(relation, "", "")
}

func newScopedMapping(relation, group, resource string) actionMappig {
	return actionMappig{relation, group, resource}
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
			"folders:read":                 newMapping(RelationRead),
			"folders:write":                newMapping(RelationWrite),
			"folders:create":               newMapping(RelationCreate),
			"folders:delete":               newMapping(RelationDelete),
			"folders.permissions:read":     newMapping(RelationPermissionsRead),
			"folders.permissions:write":    newMapping(RelationPermissionsWrite),
			"dashboards:read":              newScopedMapping(RelationRead, dashboardGroup, dashboardResource),
			"dashboards:write":             newScopedMapping(RelationWrite, dashboardGroup, dashboardResource),
			"dashboards:create":            newScopedMapping(RelationCreate, dashboardGroup, dashboardResource),
			"dashboards:delete":            newScopedMapping(RelationDelete, dashboardGroup, dashboardResource),
			"dashboards.permissions:read":  newScopedMapping(RelationPermissionsRead, dashboardGroup, dashboardResource),
			"dashboards.permissions:write": newScopedMapping(RelationPermissionsWrite, dashboardGroup, dashboardResource),
		},
	},
	KindDashboards: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: dashboardResource,
		mapping: map[string]actionMappig{
			"dashboards:read":              newMapping(RelationRead),
			"dashboards:write":             newMapping(RelationWrite),
			"dashboards:create":            newMapping(RelationCreate),
			"dashboards:delete":            newMapping(RelationDelete),
			"dashboards.permissions:read":  newMapping(RelationPermissionsRead),
			"dashboards.permissions:write": newMapping(RelationPermissionsWrite),
		},
	},
}
