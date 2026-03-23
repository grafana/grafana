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
		name                      string
		externalOrgs              []string
		orgMappingSettings        []string
		directlyMappedRole        org.RoleType
		strictRoleMapping         bool
		AllowWildcardInOrgMapping bool
		getAllOrgsError           error
		expected                  map[int64]org.RoleType
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
			name:               "should return nil when no org mapping settings are provided and directly mapped role is not set and strict role mapping is enabled",
			externalOrgs:       []string{},
			orgMappingSettings: []string{},
			directlyMappedRole: "",
			strictRoleMapping:  true,
			expected:           nil,
		},
		{
			name:               "should return nil when org mapping doesn't match any of the external orgs and no directly mapped role is provided and strict role mapping is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"Second:1:Editor"},
			directlyMappedRole: "",
			strictRoleMapping:  true,
			expected:           nil,
		},
		// In this case the parsed org mapping will be empty because the role is invalid
		{
			name:               "should return nil for the org if the specified role is invalid and strict role mapping is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor"},
			directlyMappedRole: "",
			strictRoleMapping:  true,
			expected:           nil,
		},
		{
			name:               "should map the directly mapped role to default org if the org mapping is invalid and strict role mapping is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor"},
			directlyMappedRole: "Editor",
			strictRoleMapping:  true,
			expected:           map[int64]org.RoleType{2: org.RoleEditor},
		},
		{
			name:               "should return nil if the org mapping contains at least one invalid setting and directly mapped role is empty and strict role mapping is enabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1:SuperEditor", "First:1:Admin"},
			directlyMappedRole: "",
			strictRoleMapping:  true,
			expected:           nil,
		},
		{
			name:               "should map the directly mapped role if the org mapping contains at least one invalid setting and strict role mapping is disabled",
			externalOrgs:       []string{"First"},
			orgMappingSettings: []string{"First:1", "Second:"},
			directlyMappedRole: "Editor",
			strictRoleMapping:  false,
			expected:           map[int64]org.RoleType{1: org.RoleEditor},
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
			name:               "should map correctly when fallback org mapping is provided and fallback has a higher role",
			externalOrgs:       []string{"First", "Second", "Third"},
			orgMappingSettings: []string{"First:1:Viewer", "*:1:Editor", "Second:2:Viewer"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleEditor, 2: org.RoleViewer},
		},
		{
			name:               "should map correctly when fallback org mapping is provided and fallback has a lower role",
			externalOrgs:       []string{"First", "Second", "Third"},
			orgMappingSettings: []string{"First:1:Editor", "*:1:Viewer", "Second:2:Viewer"},
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
			name:                      "should map correctly and respect the mapping precedence when multiple org mappings are provided for the same org",
			externalOrgs:              []string{"First"},
			orgMappingSettings:        []string{"First:1:Editor", "First:1:Viewer"},
			directlyMappedRole:        "",
			AllowWildcardInOrgMapping: true,
			expected:                  map[int64]org.RoleType{1: org.RoleViewer},
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
		// MapOrgRoles immediately resolves wildcard mappings into static ones, so all behavior for them applies
		// Besides a smoke test, most of the testing resides with resolveWildcardMappings.
		{
			name:                      "should map to all organizations matching the wildcard",
			externalOrgs:              []string{"First_viewer", "Second_edit", "3_Admin", "Fourth_Frobulator"},
			orgMappingSettings:        []string{"*_viewer:*:Viewer", "*_edit:*:Editor", "*_Admin:*:Admin"},
			directlyMappedRole:        "",
			AllowWildcardInOrgMapping: true,
			expected:                  map[int64]org.RoleType{1: org.RoleViewer, 2: org.RoleEditor, 3: org.RoleAdmin},
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
			cfg.JWTAuth.AllowWildcardInOrgMapping = tc.AllowWildcardInOrgMapping
			mappingCfg := mapper.ParseOrgMappingSettings(context.Background(), tc.orgMappingSettings, tc.strictRoleMapping)
			actual := mapper.MapOrgRoles(context.Background(), mappingCfg, tc.externalOrgs, tc.directlyMappedRole)

			assert.EqualValues(t, tc.expected, actual)
		})
	}
}

func TestOrgRoleMapper_MapOrgRoles_ReturnsDefaultOnNilMapping(t *testing.T) {
	orgService := orgtest.NewOrgServiceFake()
	cfg := setting.NewCfg()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 2
	cfg.AutoAssignOrgRole = string(org.RoleViewer)
	mapper := ProvideOrgRoleMapper(cfg, orgService)

	actual := mapper.MapOrgRoles(context.Background(), NewMappingConfiguration(map[string]map[int64]org.RoleType{}, false), []string{"First"}, org.RoleNone)

	assert.EqualValues(t, map[int64]org.RoleType{2: org.RoleNone}, actual)
}

func TestOrgRoleMapper_ParseOrgMappingSettings(t *testing.T) {
	testCases := []struct {
		name       string
		rawMapping []string
		roleStrict bool
		setupMock  func(*orgtest.MockService)
		expected   MappingConfiguration
	}{
		{
			name:       "should return empty mapping when no org mapping settings are provided",
			rawMapping: []string{},
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{}, false),
		},
		{
			name:       "should return empty mapping when role is invalid and role strict is enabled",
			rawMapping: []string{"Second:1:SuperEditor"},
			roleStrict: true,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{}, true),
		},
		{
			name:       "should return correct mapping when org mapping part is missing from a mapping and role strict is disabled",
			rawMapping: []string{"Second:1", "First:"},
			roleStrict: false,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{"Second": {1: org.RoleViewer}}, false),
		},
		{
			name:       "should return default mapping when role is invalid and strict role mapping is disabled",
			rawMapping: []string{"Second:1:SuperEditor"},
			roleStrict: false,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{"Second": {1: org.RoleViewer}}, false),
		},
		{
			name:       "should return empty mapping when org mapping doesn't contain any role and strict role mapping is enabled",
			rawMapping: []string{"Second:1"},
			roleStrict: true,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{}, true),
		},
		{
			name:       "should return default mapping when org mapping doesn't contain any role and strict is disabled",
			rawMapping: []string{"Second:1"},
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{"Second": {1: org.RoleViewer}}, false),
		},
		{
			name:       "should return correct mapping when the first part contains multiple colons",
			rawMapping: []string{"Groups\\:IT\\:ops:1:Viewer"},
			roleStrict: false,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{"Groups:IT:ops": {1: org.RoleViewer}}, false),
		},
		{
			name:       "should return correct mapping when the org name contains multiple colons",
			rawMapping: []string{`Group1:Org\:1:Viewer`},
			roleStrict: false,
			setupMock: func(orgService *orgtest.MockService) {
				orgService.On("GetByName", mock.Anything, mock.MatchedBy(func(query *org.GetOrgByNameQuery) bool {
					return query.Name == "Org:1"
				})).Return(&org.Org{ID: 1}, nil)
			},
			expected: NewMappingConfiguration(map[string]map[int64]org.RoleType{"Group1": {1: org.RoleViewer}}, false),
		},
		{
			name:       "should return empty mapping when org mapping is nil",
			rawMapping: nil,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{}, false),
		},
		{
			name:       "should return empty mapping when one of the org mappings are not in the correct format and strict role mapping is enabled",
			rawMapping: []string{"Second:Group:1:SuperEditor", "Second:1:Viewer"},
			roleStrict: true,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{}, true),
		},
		{
			name:       "should skip org mapping when one of the org mappings are not in the correct format and strict role mapping is enabled",
			rawMapping: []string{"Second:Group:1:SuperEditor", "Second:1:Admin"},
			roleStrict: false,
			expected:   NewMappingConfiguration(map[string]map[int64]org.RoleType{"Second": {1: org.RoleAdmin}}, false),
		},
		{
			name:       "should return empty mapping if at least one org was not found or the resolution failed and strict role mapping is enabled",
			rawMapping: []string{"ExternalOrg1:First:Editor", "ExternalOrg1:NonExistent:Viewer"},
			roleStrict: true,
			setupMock: func(orgService *orgtest.MockService) {
				orgService.On("GetByName", mock.Anything, mock.MatchedBy(func(query *org.GetOrgByNameQuery) bool {
					return query.Name == "First"
				})).Return(&org.Org{ID: 1}, nil)
				orgService.On("GetByName", mock.Anything, mock.Anything).Return(nil, assert.AnError)
			},
			expected: NewMappingConfiguration(map[string]map[int64]org.RoleType{}, true),
		},
		{
			name:       "should skip org mapping if org was not found or the resolution fails and strict role mapping is disabled",
			rawMapping: []string{"ExternalOrg1:First:Editor", "ExternalOrg1:NonExistent:Viewer"},
			roleStrict: false,
			setupMock: func(orgService *orgtest.MockService) {
				orgService.On("GetByName", mock.Anything, mock.MatchedBy(func(query *org.GetOrgByNameQuery) bool {
					return query.Name == "First"
				})).Return(&org.Org{ID: 1}, nil)
				orgService.On("GetByName", mock.Anything, mock.Anything).Return(nil, assert.AnError)
			},
			expected: NewMappingConfiguration(map[string]map[int64]org.RoleType{"ExternalOrg1": {1: org.RoleEditor}}, false),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			orgService := orgtest.NewMockService(t)
			if tc.setupMock != nil {
				tc.setupMock(orgService)
			}
			mapper := ProvideOrgRoleMapper(cfg, orgService)

			actual := mapper.ParseOrgMappingSettings(context.Background(), tc.rawMapping, tc.roleStrict)

			assert.EqualValues(t, tc.expected, actual)
		})
	}
}

// Since the AllowWildcardInOrgMapping flag changes the behaviour by deferring lookup, we test it separately
func TestOrgRoleMapper_ParseOrgMappingSettings_WithAllowWildcardInOrgMapping(t *testing.T) {
	testCases := []struct {
		name       string
		rawMapping []string
		roleStrict bool
		expected   MappingConfiguration
	}{
		{
			name:       "should store the parsed mapping for latter resolution",
			rawMapping: []string{"First:1:Editor", "*_admin:*:Admin", "team_*_viewer:org_*:Viewer"},
			roleStrict: true,
			expected: NewDynamicMappingConfiguration([]WildcardMapping{
				{
					externalPattern: "First",
					internalPattern: "1",
					role:            "Editor",
				},
				{
					externalPattern: "*_admin",
					internalPattern: "*",
					role:            "Admin",
				},
				{
					externalPattern: "team_*_viewer",
					internalPattern: "org_*",
					role:            "Viewer",
				},
			}, true),
		},
		{
			name:       "should just ignore an invalid mapping if roleStrict is false",
			rawMapping: []string{"First:1:Editor", "*_admin:*:Admin:AlsoILikePonies", "team_*_viewer:org_*:Viewer"},
			roleStrict: false,
			expected: NewDynamicMappingConfiguration([]WildcardMapping{
				{
					externalPattern: "First",
					internalPattern: "1",
					role:            "Editor",
				},
				{
					externalPattern: "team_*_viewer",
					internalPattern: "org_*",
					role:            "Viewer",
				},
			}, false),
		},
		{
			name:       "should return a completely empty mapping config if one mapping is invalid and roleStrict is true",
			rawMapping: []string{"First:1:Editor", "*_admin:*:Admin:AlsoILikePonies", "team_*_viewer:org_*:Viewer"},
			roleStrict: true,
			expected:   NewDynamicMappingConfiguration([]WildcardMapping{}, true),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.JWTAuth.AllowWildcardInOrgMapping = true
			orgService := orgtest.NewOrgServiceFake()
			mapper := ProvideOrgRoleMapper(cfg, orgService)

			actual := mapper.ParseOrgMappingSettings(context.Background(), tc.rawMapping, tc.roleStrict)

			assert.EqualValues(t, tc.expected, actual)
		})
	}
}

func TestOrgRoleMapper_getMappedOrgByWildcardMatch(t *testing.T) {
	testCases := []struct {
		name            string
		src             string
		dst             string
		input           string
		expectedMatched bool
		expectedOut     string
	}{
		{
			name: "should replace the wildcard in dst from the match in src",
			src:  "*_admin", dst: "*", input: "foo_admin",
			expectedMatched: true, expectedOut: "foo",
		},
		{
			name: "should return dst if neither src nor dst have a wildcard",
			src:  "src", dst: "dst", input: "foobar",
			expectedMatched: true, expectedOut: "dst",
		},
		{
			name: "should return no match if input does not match src",
			src:  "*_admin", dst: "*", input: "foo_other",
			expectedMatched: false, expectedOut: "",
		},
		{
			name: "should return a litteral dst if input matches src",
			src:  "foo_*", dst: "litteral", input: "foo_bar",
			expectedMatched: true, expectedOut: "litteral",
		},
		{
			name: "should return no match if only dst has a wildcard",
			src:  "literal", dst: "*", input: "literal",
			expectedMatched: false, expectedOut: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			matched, out := getMappedOrgByWildcardMatch(tc.src, tc.dst, tc.input)
			assert.EqualValues(t, tc.expectedMatched, matched)
			assert.EqualValues(t, tc.expectedOut, out)
		})
	}
}

func TestOrgRoleMapper_resolveWildcardMappings(t *testing.T) {
	testCases := []struct {
		name                 string
		externalOrg          string
		mappingConfiguration MappingConfiguration
		want                 map[int64]org.RoleType
	}{
		{
			name:        "should resolve back to a static mapping",
			externalOrg: "foo",
			mappingConfiguration: NewDynamicMappingConfiguration([]WildcardMapping{
				{
					externalPattern: "First",
					internalPattern: "1",
					role:            org.RoleEditor,
				},
				{
					externalPattern: "First",
					internalPattern: "1",
					role:            org.RoleViewer,
				},
			}, true),
			want: map[int64]org.RoleType{1: org.RoleViewer},
		},
		{
			name:        "should resolve back by resolving the wildcard in the pattern",
			externalOrg: "Third_admin",
			mappingConfiguration: NewDynamicMappingConfiguration([]WildcardMapping{
				{
					externalPattern: "*_admin",
					internalPattern: "*",
					role:            org.RoleAdmin,
				},
			}, true),
			want: map[int64]org.RoleType{3: org.RoleAdmin},
		},
	}
	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedOrgs = []*org.OrgDTO{
		{Name: "First", ID: 1},
		{Name: "Second", ID: 2},
		{Name: "Third", ID: 3},
	}
	cfg := setting.NewCfg()
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			m := ProvideOrgRoleMapper(cfg, orgService)
			got := m.resolveWildcardMappings(context.Background(), tc.externalOrg, tc.mappingConfiguration)
			assert.EqualValues(t, tc.want, got)
		})
	}
}
