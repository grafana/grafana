package connectors

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOrgRoleMapper_MapOrgRoles(t *testing.T) {
	testCases := []struct {
		name               string
		externalOrgs       []string
		orgMappingSettings []string
		directlyMappedRole org.RoleType
		roleStrict         bool
		getAllOrgsError    error
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
			name:               "should return the default mapping when no org mapping settings are provided and direcly mapped role is set",
			externalOrgs:       []string{},
			orgMappingSettings: []string{},
			directlyMappedRole: org.RoleEditor,
			expected:           map[int64]org.RoleType{2: org.RoleEditor},
		},
		{
			name:               "should return the default mapping when org mapping doesn't match any of the external orgs and no directly mapped role is provided",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"Second:1:Editor"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{2: org.RoleViewer},
		},
		{
			name:               "should return Viewer role for the org if the specified role is invalid",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleViewer},
		},
		{
			name:               "should return nil when no org mapping settings are provided and directly mapped role is not set and strict mapping is enabled",
			externalOrgs:       []string{},
			orgMappingSettings: []string{},
			directlyMappedRole: "",
			roleStrict:         true,
			expected:           nil,
		},
		{
			name:               "should return nil when org mapping doesn't match any of the external orgs and no directly mapped role is provided and strict mapping is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"Second:1:Editor"},
			directlyMappedRole: "",
			roleStrict:         true,
			expected:           nil,
		},
		// In this case the parsed org mapping will be empty because the role is invalid
		{
			name:               "should return nil for the org if the specified role is invalid and role strict is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor"},
			directlyMappedRole: "",
			roleStrict:         true,
			expected:           nil,
		},
		{
			name:               "should map the direclty mapped role to default org if the org mapping is invalid and role strict is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor"},
			directlyMappedRole: "Editor",
			roleStrict:         true,
			expected:           map[int64]org.RoleType{2: org.RoleEditor},
		},
		{
			name:               "should return nil if the org mapping contains at least one invalid setting and directly mapped role is empty and role strict is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor", "First:1:Admin"},
			directlyMappedRole: "",
			roleStrict:         true,
			expected:           nil,
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
		{
			name:               "should skip map to all organizations if org service returns an error",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:*:Editor"},
			getAllOrgsError:    assert.AnError,
			directlyMappedRole: org.RoleAdmin,
			expected:           nil,
		},
	}
	orgService := orgtest.NewOrgServiceFake()
	cfg := setting.NewCfg()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 2
	cfg.AutoAssignOrgRole = string(org.RoleViewer)
	mapper := ProvideOrgRoleMapper(cfg, orgService)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.getAllOrgsError != nil {
				orgService.ExpectedError = tc.getAllOrgsError
			} else {
				orgService.ExpectedOrgs = []*org.OrgDTO{
					{Name: "First", ID: 1},
					{Name: "Second", ID: 2},
					{Name: "Third", ID: 3},
				}
			}
			mappingCfg := mapper.ParseOrgMappingSettings(context.Background(), tc.orgMappingSettings, tc.roleStrict)
			actual := mapper.MapOrgRoles(context.Background(), mappingCfg, tc.externalOrgs, tc.directlyMappedRole)

			assert.EqualValues(t, tc.expected, actual)
		})
	}
}

func TestOrgRoleMapper_MapOrgRoles_OrgNameResolution(t *testing.T) {
	t.Skip()
	testCases := []struct {
		name             string
		orgMapping       []string
		setupMock        func(*orgtest.MockService)
		expectedOrgRoles map[int64]org.RoleType
	}{
		{
			name:       "should skip org mapping if org was not found or the resolution fails",
			orgMapping: []string{"ExternalOrg1:First:Editor", "ExternalOrg1:NonExistent:Viewer"},
			setupMock: func(orgService *orgtest.MockService) {
				orgService.On("GetByName", mock.Anything, mock.MatchedBy(func(query *org.GetOrgByNameQuery) bool {
					return query.Name == "First"
				})).Return(&org.Org{ID: 1}, nil)
				orgService.On("GetByName", mock.Anything, mock.Anything).Return(nil, assert.AnError)
			},
			expectedOrgRoles: map[int64]org.RoleType{1: org.RoleEditor}, // TODO: should this be nil or error?
		},
		{
			name:       "should return nil when all of the org names are invalid",
			orgMapping: []string{"ExternalOrg1:NonExistent1:Editor", "ExternalOrg1:NonExistent2:Viewer"},
			setupMock: func(orgService *orgtest.MockService) {
				orgService.On("GetByName", mock.Anything, mock.Anything).Return(nil, assert.AnError)
			},
			expectedOrgRoles: nil,
		},
	}

	cfg := setting.NewCfg()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 2
	cfg.AutoAssignOrgRole = string(org.RoleViewer)

	orgService := orgtest.NewMockService(t)
	mapper := ProvideOrgRoleMapper(cfg, orgService)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			orgService.ExpectedCalls = nil
			tc.setupMock(orgService)

			mappingCfg := mapper.ParseOrgMappingSettings(context.Background(), tc.orgMapping, false)
			actual := mapper.MapOrgRoles(context.Background(), mappingCfg, []string{"ExternalOrg1"}, org.RoleViewer)

			assert.EqualValues(t, tc.expectedOrgRoles, actual)
		})
	}
}

func TestOrgRoleMapper_ParseOrgMappingSettings(t *testing.T) {
	testCases := []struct {
		name       string
		rawMapping []string
		roleStrict bool
		expected   *MappingConfiguration
	}{
		{
			name:       "should return empty mapping when no org mapping settings are provided",
			rawMapping: []string{},
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{},
				strictRoleMapping: false,
			},
		},
		{
			name:       "should return empty mapping when role is invalid and role strict is enabled",
			rawMapping: []string{"Second:1:SuperEditor"},
			roleStrict: true,
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{},
				strictRoleMapping: true,
			},
		},
		{
			name:       "should return default mapping when role is invalid and role strict is disabled",
			rawMapping: []string{"Second:1:SuperEditor"},
			roleStrict: false,
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{"Second": {1: org.RoleViewer}},
				strictRoleMapping: false,
			},
		},
		{
			name:       "should return empty mapping when org mapping doesn't contain the role and strict is enabled",
			rawMapping: []string{"Second:1"},
			roleStrict: true,
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{},
				strictRoleMapping: true,
			},
		},
		{
			name:       "should return empty mapping when org mapping doesn't contain the role and strict is disabled",
			rawMapping: []string{"Second:1"},
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{"Second": {1: org.RoleViewer}},
				strictRoleMapping: false,
			},
		},
		{
			name:       "should return empty mapping when org mapping is empty",
			rawMapping: []string{},
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{},
				strictRoleMapping: false,
			},
		},
		{
			name:       "should return empty mapping when org mapping is nil",
			rawMapping: nil,
			expected: &MappingConfiguration{
				orgMapping:        map[string]map[int64]org.RoleType{},
				strictRoleMapping: false,
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			orgService := orgtest.NewOrgServiceFake()
			mapper := ProvideOrgRoleMapper(cfg, orgService)

			actual := mapper.ParseOrgMappingSettings(context.Background(), tc.rawMapping, tc.roleStrict)

			assert.EqualValues(t, tc.expected, actual)
		})
	}
}
