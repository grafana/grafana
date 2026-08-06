package orgimpl

import (
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}
	queryTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			syncOrgSequenceTemplate: {
				{
					Name: "sync_org_sequence",
					Data: syncOrgSequenceQuery{
						SQLTemplate: queryTemplate(),
						OrgTable:    dbHelper.Table("org"),
						OrgSequence: `"test_schema"."org_id_seq"`,
					},
				},
			},
			deleteByIDTemplate: {
				{
					Name: "delete_by_id",
					Data: deleteByIDQuery{
						SQLTemplate: queryTemplate(),
						Table:       dbHelper.Table("org_user"),
						Column:      "user_id",
						ID:          42,
					},
				},
			},
			deleteAlertRuleTagsByOrgTemplate: {
				{
					Name: "delete_alert_rule_tags_by_org",
					Data: deleteAlertRuleTagsByOrgQuery{
						SQLTemplate:       queryTemplate(),
						AlertRuleTagTable: dbHelper.Table("alert_rule_tag"),
						AlertTable:        dbHelper.Table("alert"),
						OrgID:             7,
					},
				},
			},
			orgExistsTemplate: {
				{
					Name: "org_exists",
					Data: orgExistsQuery{
						SQLTemplate: queryTemplate(),
						OrgTable:    dbHelper.Table("org"),
						OrgID:       7,
					},
				},
			},
			orgUserExistsTemplate: {
				{
					Name: "org_user_exists",
					Data: orgUserExistsQuery{
						SQLTemplate:  queryTemplate(),
						OrgUserTable: dbHelper.Table("org_user"),
						OrgID:        7,
						UserID:       42,
					},
				},
			},
			countOrgsTemplate: {
				{
					Name: "count_orgs",
					Data: countOrgsQuery{
						SQLTemplate: queryTemplate(),
						OrgTable:    dbHelper.Table("org"),
					},
				},
			},
			countOrgUsersTemplate: {
				{
					Name: "count_org_users",
					Data: countOrgUsersQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						UserTable:        dbHelper.Table("user"),
						OrgID:            7,
						IsServiceAccount: false,
					},
				},
			},
			countUserOrgsTemplate: {
				{
					Name: "count_user_orgs",
					Data: countUserOrgsQuery{
						SQLTemplate:  queryTemplate(),
						OrgUserTable: dbHelper.Table("org_user"),
						UserID:       42,
					},
				},
			},
			validateOrgAdminTemplate: {
				{
					Name: "validate_org_admin",
					Data: validateOrgAdminQuery{
						SQLTemplate:  queryTemplate(),
						OrgUserTable: dbHelper.Table("org_user"),
						OrgID:        7,
						Role:         org.RoleAdmin,
					},
				},
			},
			deleteByOrgAndUserTemplate: {
				{
					Name: "delete_by_org_and_user",
					Data: deleteByOrgAndUserQuery{
						SQLTemplate: queryTemplate(),
						Table:       dbHelper.Table("org_user"),
						OrgID:       7,
						UserID:      42,
					},
				},
			},
			deletePermissionByScopeTemplate: {
				{
					Name: "delete_permission_by_scope",
					Data: deletePermissionByScopeQuery{
						SQLTemplate:     queryTemplate(),
						PermissionTable: dbHelper.Table("permission"),
						Scope:           accesscontrol.Scope("users", "id", "42"),
					},
				},
			},
			managedUserRoleIDsTemplate: {
				{
					Name: "managed_user_role_ids",
					Data: managedUserRoleIDsQuery{
						SQLTemplate: queryTemplate(),
						RoleTable:   dbHelper.Table("role"),
						RoleName:    accesscontrol.ManagedUserRoleName(42),
					},
				},
			},
			deletePermissionsByRoleIDsTemplate: {
				{
					Name: "delete_permissions_by_role_ids",
					Data: deletePermissionsByRoleIDsQuery{
						SQLTemplate:     queryTemplate(),
						PermissionTable: dbHelper.Table("permission"),
						RoleIDs:         []int64{11, 12},
					},
				},
				{
					Name:            "empty_role_ids",
					ValidationError: "role IDs must not be empty",
					Data: deletePermissionsByRoleIDsQuery{
						SQLTemplate:     queryTemplate(),
						PermissionTable: dbHelper.Table("permission"),
					},
				},
			},
			deleteRoleByNameTemplate: {
				{
					Name: "delete_role_by_name",
					Data: deleteRoleByNameQuery{
						SQLTemplate: queryTemplate(),
						RoleTable:   dbHelper.Table("role"),
						RoleName:    accesscontrol.ManagedUserRoleName(42),
					},
				},
			},
			getUserByIDTemplate: {
				{
					Name: "get_user_by_id",
					Data: getUserByIDQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						UserID:           42,
						IsServiceAccount: false,
					},
				},
			},
			getUserOrgListTemplate: {
				{
					Name: "get_user_org_list",
					Data: getUserOrgListQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						OrgTable:         dbHelper.Table("org"),
						UserTable:        dbHelper.Table("user"),
						UserID:           42,
						IsServiceAccount: false,
					},
				},
			},
			searchOrgUsersTemplate: {
				{
					Name: "all_filters",
					Data: searchOrgUsersQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						UserTable:        dbHelper.Table("user"),
						OrgID:            7,
						FilterByUserID:   true,
						UserID:           42,
						IsServiceAccount: false,
						AccessUserIDs:    []any{11, 12},
						HiddenUserLogins: []string{"hidden-user", "another-hidden-user"},
						QueryPattern:     "%ops%",
						Sorts:            []orgUserSort{orgUserSortLoginDesc, orgUserSortEmailAsc},
						Limit:            25,
						Offset:           50,
					},
				},
				{
					Name: "denied",
					Data: searchOrgUsersQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						UserTable:        dbHelper.Table("user"),
						OrgID:            7,
						IsServiceAccount: false,
					},
				},
			},
			countSearchOrgUsersTemplate: {
				{
					Name: "all_filters",
					Data: searchOrgUsersQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						UserTable:        dbHelper.Table("user"),
						OrgID:            7,
						FilterByUserID:   true,
						UserID:           42,
						IsServiceAccount: false,
						AccessUserIDs:    []any{11, 12},
						HiddenUserLogins: []string{"hidden-user", "another-hidden-user"},
						QueryPattern:     "%ops%",
					},
				},
			},
			searchOrgUsersByEmailsTemplate: {
				{
					Name: "search_org_users_by_emails",
					Data: searchOrgUsersByEmailsQuery{
						SQLTemplate:      queryTemplate(),
						OrgUserTable:     dbHelper.Table("org_user"),
						UserTable:        dbHelper.Table("user"),
						OrgID:            7,
						Emails:           []string{"first@example.com", "second@example.com"},
						IsServiceAccount: false,
						HiddenUserLogins: []string{"hidden-user"},
					},
				},
			},
		},
	})
}

func TestSearchOrgUsersQueryArguments(t *testing.T) {
	query := searchOrgUsersQuery{
		SQLTemplate:      sqltemplate.New(sqltemplate.PostgreSQL),
		OrgUserTable:     "test_schema.org_user",
		UserTable:        "test_schema.user",
		OrgID:            7,
		FilterByUserID:   true,
		UserID:           42,
		IsServiceAccount: false,
		AccessUserIDs:    []any{11, 12},
		HiddenUserLogins: []string{"hidden-user", "another-hidden-user"},
		QueryPattern:     "%ops%",
		Sorts:            []orgUserSort{orgUserSortLoginDesc, orgUserSortEmailAsc},
		Limit:            25,
		Offset:           50,
	}

	_, err := sqltemplate.Execute(searchOrgUsersTemplate, query)
	require.NoError(t, err)
	require.Equal(t, []any{
		int64(7),
		int64(42),
		false,
		11,
		12,
		"hidden-user",
		"another-hidden-user",
		"%ops%",
		"%ops%",
		"%ops%",
		25,
		50,
	}, query.GetArgs())
}

type testOrderBy string

func (s testOrderBy) OrderBy() string { return string(s) }

func TestOrgUserSearchSorts(t *testing.T) {
	query := &org.SearchOrgUsersQuery{
		SortOpts: []model.SortOption{{
			Filter: []model.SortOptionFilter{testOrderBy("u.login; DROP TABLE user")},
		}},
	}

	require.Empty(t, orgUserSorts(query))
	require.Equal(t, 0, orgUserSearchOffset(25, 0))
	require.Equal(t, 25, orgUserSearchOffset(25, 2))
}

func TestQueryValidation(t *testing.T) {
	require.Error(t, searchOrgUsersQuery{}.Validate())
	require.Error(t, searchOrgUsersByEmailsQuery{
		OrgUserTable: "test_schema.org_user",
		UserTable:    "test_schema.user",
	}.Validate())
}
