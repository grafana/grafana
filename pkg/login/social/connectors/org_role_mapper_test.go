package connectors

import (
	"context"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"

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
		strictRoleMapping  bool
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
		{
			name:               "should fill the org and role templates from a regexp match on the external org",
			externalOrgs:       []string{"First_Editor"},
			orgMappingSettings: []string{"(.*)_(.*):$1:$2"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleEditor},
		},
		{
			name:               "should not confuse the special case '*' for a regexp pattern",
			externalOrgs:       []string{"First_Editor"},
			orgMappingSettings: []string{"(.*)_(.*):$1:$2", "*:1:Admin"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{1: org.RoleAdmin},
		},
		{
			name:               "should treat invalid regexps as regular strings with no match or expansion",
			externalOrgs:       []string{"First_Editor"},
			orgMappingSettings: []string{"*invalid(.*)_(.*):$1:$2"},
			directlyMappedRole: "",
			expected:           map[int64]org.RoleType{2: org.RoleViewer},
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

	actual := mapper.MapOrgRoles(context.Background(), NewMappingConfiguration([]MappingEntry{}, false), []string{"First"}, org.RoleNone)

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
			name:       "should return an empty configuration when no org mapping settings are provided",
			rawMapping: []string{},
			expected:   NewMappingConfiguration([]MappingEntry{}, false),
		},
		{
			name:       "should return an empty configuration when org mapping is nil",
			rawMapping: nil,
			expected:   NewMappingConfiguration([]MappingEntry{}, false),
		},
		{
			name:       "should return an entry for each valid mapping",
			rawMapping: []string{"First:1:Editor", "(.*)_(.*):$1:$2"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("(.*)_(.*)", regexp.MustCompile("(.*)_(.*)"), "$1", "$2"),
			}, false),
		},
		{
			name:       "should filter out malformed mappings",
			rawMapping: []string{"First:1:Editor", "Second:2:Viewer", "Third", "F:o:u:r:t:h"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("Second", regexp.MustCompile("Second"), "2", "Viewer"),
			}, false),
		},
		{
			name:       "should return an empty configuration if one mapping was malformed and role strict is enabled",
			rawMapping: []string{"First:1:Editor", "Second:2:Viewer", "Third", "Fourth:Group:3:Viewer"},
			roleStrict: true,
			expected:   NewMappingConfiguration([]MappingEntry{}, true),
		},
		{
			name:       "should replace missing roles with Viewer if role strict is disabled",
			rawMapping: []string{"First:1:Editor", "Second:2:Viewer", "Third:3"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("Second", regexp.MustCompile("Second"), "2", "Viewer"),
				NewMappingEntry("Third", regexp.MustCompile("Third"), "3", "Viewer"),
			}, false),
		},
		{
			name:       "should return an empty configuration when a role is missing and role strict is enabled",
			rawMapping: []string{"First:1:Editor", "Second:2:Viewer", "Third:3"},
			roleStrict: true,
			expected:   NewMappingConfiguration([]MappingEntry{}, true),
		},
		{
			name:       "should not set a regexp if its compilation failed",
			rawMapping: []string{"First:1:Editor", "*invalid:2:Viewer", "Third:3"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("*invalid", nil, "2", "Viewer"),
				NewMappingEntry("Third", regexp.MustCompile("Third"), "3", "Viewer"),
			}, false),
		},
		// Technically just a specific case of the previous test, but made explicit to confirm non-regression
		{
			name:       "should not set a regexp if the pattern is a single star",
			rawMapping: []string{"First:1:Editor", "*:2:Viewer", "Third:3"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("*", nil, "2", "Viewer"),
				NewMappingEntry("Third", regexp.MustCompile("Third"), "3", "Viewer"),
			}, false),
		},

		// Since the role is a template that will be filled on login, we can't validate it yet
		{
			name:       "should not enforce validity of role",
			rawMapping: []string{"First:1:Editor", "Second:2:Viewer", "Third:3:SuperEditor"},
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("First", regexp.MustCompile("First"), "1", "Editor"),
				NewMappingEntry("Second", regexp.MustCompile("Second"), "2", "Viewer"),
				NewMappingEntry("Third", regexp.MustCompile("Third"), "3", "SuperEditor"),
			}, false),
		},

		{
			name:       "should correctly escape colons",
			rawMapping: []string{"Groups\\:IT\\:ops:Org\\:1:Viewer"},
			roleStrict: false,
			expected: NewMappingConfiguration([]MappingEntry{
				NewMappingEntry("Groups:IT:ops", regexp.MustCompile("Groups:IT:ops"), "Org:1", "Viewer"),
			}, false),
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
