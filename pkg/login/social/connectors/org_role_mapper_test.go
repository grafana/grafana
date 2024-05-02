package connectors

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestExternalOrgRoleMapper_MapOrgRoles(t *testing.T) {
	t.Skip("Outdated tests, the most recent version of the code is in a separate PR")
	testCases := []struct {
		name               string
		externalOrgs       []string
		orgMappingSettings []string
		directlyMappedRole org.RoleType
		expected           map[int64]org.RoleType
	}{
		{
			name:               "should return the default mapping when no org mapping settings are provided and directly mapped role is not set",
			externalOrgs:       []string{},
			orgMappingSettings: []string{},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{2: org.RoleViewer},
		},
		{
			name:               "should return the default mapping when no org mapping settings are provided",
			externalOrgs:       []string{},
			orgMappingSettings: []string{},
			directlyMappedRole: org.RoleEditor,
			expected:           map[int64]org.RoleType{2: org.RoleEditor},
		},
		{
			name:               "should return the default mapping when org mapping doesn't match any of the external orgs and no directly mapped role is not provided",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"Second:1:Editor"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{2: org.RoleViewer},
		},
		{
			name:               "should map the higher role if directly mapped role is lower than the role found in the org mapping",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:Editor"},
			directlyMappedRole: org.RoleViewer,
			expected:           map[int64]org.RoleType{1: org.RoleEditor},
		},
		{
			name:               "should map the directly mapped role if it is higher than the role found in the org mapping",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:Viewer"},
			directlyMappedRole: org.RoleEditor,
			expected:           map[int64]org.RoleType{1: org.RoleEditor},
		},
		{
			name:               "should map to multiple organizations and set the directly mapped role for those if it is higher than the role found in the org mapping",
			externalOrgs:       []string{"First", "Second"},
			orgMappingSettings: []string{"First:1:Viewer", "Second:2:Viewer"},
			directlyMappedRole: org.RoleEditor,
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleEditor},
		},
		{
			name:               "should map to multiple organizations and set the directly mapped role for those if the directly mapped role is not set",
			externalOrgs:       []string{"First", "Second"},
			orgMappingSettings: []string{"First:1:Viewer", "Second:2:Viewer"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleViewer, 2: org.RoleViewer},
		},
		{
			name:               "should map to all of the organizations if global org mapping is provided and the directly mapped role is set",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:*:Editor"},
			directlyMappedRole: org.RoleViewer,
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleEditor, 3: org.RoleEditor},
		},
		{
			name:               "should map to all of the organizations if global org mapping is provided and the directly mapped role is not set",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:*:Editor"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleEditor, 3: org.RoleEditor},
		},
		{
			name:               "should map to all of the organizations if global org mapping is provided and the directly mapped role is higher than the role found in the org mappings",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:*:Viewer"},
			directlyMappedRole: org.RoleEditor,
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleEditor, 3: org.RoleEditor},
		},
		{
			name:               "should map correctly when global org mapping is provided",
			externalOrgs:       []string{"First", "Second", "Third"},
			orgMappingSettings: []string{"First:1:Viewer", "*:1:Editor", "Second:2:Viewer"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleViewer},
		},
		{
			name:               "should map correctly and respect wildcard precedence when global org mapping is provided",
			externalOrgs:       []string{"First", "Second"},
			orgMappingSettings: []string{"*:1:Editor", "First:1:Viewer", "Second:2:Viewer"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleViewer},
		},
		{
			name:               "should map directly mapped role when global org mapping is provided and the directly mapped role is higher than the role found in the org mappings",
			externalOrgs:       []string{"First", "Second", "Third"},
			orgMappingSettings: []string{"First:1:Viewer", "*:1:Editor", "Second:2:Viewer"},
			directlyMappedRole: org.RoleAdmin,
			expected:           map[int64]org.RoleType{1: org.RoleAdmin, 2: org.RoleAdmin},
		},
		{
			name:               "should map correctly and respect the mapping precedence when multiple org mappings are provided for the same org",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:Editor", "First:1:Viewer"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleViewer},
		},
		{
			name:               "should map to all organizations when global org mapping is provided and the directly mapped role is higher than the role found in the org mappings",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:*:Editor"},
			directlyMappedRole: org.RoleAdmin,
			expected:           map[int64]org.RoleType{1: org.RoleAdmin, 2: org.RoleAdmin, 3: org.RoleAdmin},
		},
	}
	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedOrgs = []*org.OrgDTO{
		{Name: "First", ID: 1},
		{Name: "Second", ID: 2},
		{Name: "Third", ID: 3},
	}
	cfg := setting.NewCfg()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 2
	cfg.AutoAssignOrgRole = string(org.RoleViewer)
	mapper := ProvideOrgRoleMapper(cfg, orgService)

	for _, tc := range testCases {
		orgMapping := mapper.ParseOrgMappingSettings(context.Background(), tc.orgMappingSettings, false)
		actual := mapper.MapOrgRoles(context.Background(), tc.externalOrgs, orgMapping, tc.directlyMappedRole, false)

		assert.EqualValues(t, tc.expected, actual)
	}
}
