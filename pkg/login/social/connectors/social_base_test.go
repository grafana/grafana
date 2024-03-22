package connectors

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/stretchr/testify/require"
)

func TestExtractOrgRolesFromRaw(t *testing.T) {
	t.Run("Given a social base", func(t *testing.T) {
		orgService := &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{
				{ID: 11, Name: "org_foo"},
				{ID: 12, Name: "org_bar"},
				{ID: 13, Name: "org_baz"},
				{ID: 14, Name: "another_org"},
			},
			ExpectedError: org.ErrOrgNotFound,
		}
		ctx := context.TODO()

		tests := []struct {
			name             string
			orgAttributePath string
			orgMapping       []string
			rawJSON          string
			skipEmptyGroups  bool
			expectedError    string
			expectedOrgRoles map[int64]org.RoleType
			WarnLogs         logtest.Logs
		}{
			{
				name:             "Given role claim and valid JMES path, returns valid mapping",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"org_foo:org_foo:Viewer", "org_bar:org_bar:Editor", "*:org_baz:Editor"},
				rawJSON:          `{"info": {"roles": ["org_foo", "org_bar","another_org"]}}`,
				expectedOrgRoles: map[int64]roletype.RoleType{11: "Viewer", 12: "Editor", 13: "Editor"},
			},
			{
				name:             "Given several role claims and valid JMES path, last wins",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"org_foo:org_foo:Viewer", "org_bar:org_foo:Editor"},
				rawJSON:          `{"info": {"roles": ["org_foo", "org_bar","another_org"]}}`,
				expectedOrgRoles: map[int64]roletype.RoleType{11: "Editor"},
			},
			{
				name:             "Given invalid JMES path, returns an error",
				orgAttributePath: `[`,
				rawJSON:          `{}`,
				expectedError:    `[json-failed-to-search] failed to search user info JSON response with provided path: "[": SyntaxError: Incomplete expression`,
			},
			{
				name:             "With invalid role, returns an error",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"org_foo:org_foo:Invalid"},
				rawJSON:          `{"info": {"roles": ["org_foo"]}}`,
				expectedError:    "invalid role type: Invalid",
			},
			{
				name:             "With unfound org, skip and continue",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"org_foo:org_not_found:Viewer", "org_bar:org_bar:Admin"},
				rawJSON:          `{"info": {"roles": ["org_foo", "org_bar"]}}`,
				expectedOrgRoles: map[int64]roletype.RoleType{12: "Admin"},
				WarnLogs: logtest.Logs{
					Calls:   1,
					Message: "Unknown organization. Skipping.",
					Ctx:     []interface{}{"config_option", "info.roles", "mapping", "{0 org_not_found Viewer}"},
				},
			},
			{
				name:             "With invalid org id, skip and continue",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"org_foo:-1:Viewer", "org_bar:12:Viewer"},
				rawJSON:          `{"info": {"roles": ["org_foo", "org_bar"]}}`,
				expectedOrgRoles: map[int64]roletype.RoleType{12: "Viewer"},
				WarnLogs: logtest.Logs{
					Calls:   1,
					Message: "Incorrect mapping found. Skipping.",
					Ctx:     []interface{}{"config_option", "info.roles", "mapping", "{-1  Viewer}"},
				},
			},
			{
				name:             "With skipEmptyGroups and empty group",
				orgAttributePath: "info.roles",
				orgMapping:       []string{"*:org_baz:Editor"},
				rawJSON:          `{}`,
				skipEmptyGroups:  true,
				expectedOrgRoles: nil,
			},
		}

		for _, test := range tests {
			logger := &logtest.Fake{}
			s := SocialBase{orgService: orgService, info: &social.OAuthInfo{}, log: logger}
			s.info.OrgAttributePath = test.orgAttributePath
			s.info.OrgMapping = test.orgMapping
			t.Run(test.name, func(t *testing.T) {
				orgRoles, err := s.extractOrgRolesFromRaw(ctx, []byte(test.rawJSON), test.skipEmptyGroups)
				if test.expectedError == "" {
					require.NoError(t, err, "Testing case %q", test.name)
				} else {
					require.EqualError(t, err, test.expectedError, "Testing case %q", test.name)
				}
				require.Equal(t, test.expectedOrgRoles, orgRoles)
				require.Equal(t, test.WarnLogs, logger.WarnLogs)
			})
		}
	})
}

func TestResolveOrgMapping(t *testing.T) {
	socialBase := SocialBase{
		info: &social.OAuthInfo{},
	}
	tests := []struct {
		Name                   string
		OrgMapping             []string
		Groups                 []string
		ExpectedOrgRoleMapping []OrgRoleMapping
		ExpectedError          string
	}{
		{
			Name:       "doc sample",
			OrgMapping: []string{"org_foo:org_foo:Viewer", "org_bar:org_bar:Editor", "*:org_baz:Editor"},
			Groups:     []string{"org_foo", "org_bar", "another_org"},
			ExpectedOrgRoleMapping: []OrgRoleMapping{
				{
					OrgName: "org_foo",
					Role:    "Viewer",
				},
				{
					OrgName: "org_bar",
					Role:    "Editor",
				},
				{
					OrgName: "org_baz",
					Role:    "Editor",
				},
			},
		},
		{
			Name:       "org ids",
			OrgMapping: []string{"org_foo:11:Viewer", "org_bar:12:Editor", "*:13:Editor"},
			Groups:     []string{"org_foo", "org_bar", "another_org"},
			ExpectedOrgRoleMapping: []OrgRoleMapping{
				{
					OrgID: 11,
					Role:  "Viewer",
				},
				{
					OrgID: 12,
					Role:  "Editor",
				},
				{
					OrgID: 13,
					Role:  "Editor",
				},
			},
		},
		{
			Name:       "not org_bar member",
			OrgMapping: []string{"org_foo:org_foo:Viewer", "org_bar:org_bar:Editor", "*:org_baz:Editor"},
			Groups:     []string{"org_foo", "another_org"},
			ExpectedOrgRoleMapping: []OrgRoleMapping{
				{
					OrgName: "org_foo",
					Role:    "Viewer",
				},
				{
					OrgName: "org_baz",
					Role:    "Editor",
				},
			},
		},
		{
			Name:          "invalid org mapping",
			OrgMapping:    []string{"org_foo:org_foo"},
			ExpectedError: "invalid tag format, expected 3 parts but got 2",
		},
		{
			Name:          "invalid role type",
			OrgMapping:    []string{"org_foo:org_foo:Breaker"},
			Groups:        []string{"org_foo"},
			ExpectedError: "invalid role type: Breaker",
		},
	}
	for _, test := range tests {
		socialBase.info.OrgMapping = test.OrgMapping
		t.Run(test.Name, func(t *testing.T) {
			orgRoleMapping, err := socialBase.resolveOrgMapping(test.Groups)

			if test.ExpectedError != "" {
				require.Equal(t, err.Error(), test.ExpectedError)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.ExpectedOrgRoleMapping, orgRoleMapping)
		})
	}
}
