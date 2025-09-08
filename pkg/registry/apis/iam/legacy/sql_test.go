package legacy

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestIdentityQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getDisplay := func(q *ListDisplayQuery) sqltemplate.SQLTemplate {
		v := newListDisplay(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listUsers := func(q *ListUserQuery) sqltemplate.SQLTemplate {
		v := newListUser(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	deleteUser := func(q *DeleteUserCommand) sqltemplate.SQLTemplate {
		v := newDeleteUser(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	deleteOrgUser := func(userID int64) sqltemplate.SQLTemplate {
		v := newDeleteOrgUser(nodb, userID)
		return &v
	}

	createOrgUser := func(cmd *CreateOrgUserCommand) sqltemplate.SQLTemplate {
		v := newCreateOrgUser(nodb, cmd)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	createUser := func(cmd *CreateUserCommand) sqltemplate.SQLTemplate {
		v := newCreateUser(nodb, cmd)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeams := func(q *ListTeamQuery) sqltemplate.SQLTemplate {
		v := newListTeams(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeamBindings := func(q *ListTeamBindingsQuery) sqltemplate.SQLTemplate {
		v := newListTeamBindings(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listTeamMembers := func(q *ListTeamMembersQuery) sqltemplate.SQLTemplate {
		v := newListTeamMembers(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listUserTeams := func(q *ListUserTeamsQuery) sqltemplate.SQLTemplate {
		v := newListUserTeams(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listServiceAccounts := func(q *ListServiceAccountsQuery) sqltemplate.SQLTemplate {
		v := newListServiceAccounts(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	createServiceAccounts := func(cmd *CreateServiceAccountCommand) sqltemplate.SQLTemplate {
		v := newCreateServiceAccount(nodb, cmd)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	listServiceAccountTokens := func(q *ListServiceAccountTokenQuery) sqltemplate.SQLTemplate {
		v := newListServiceAccountTokens(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryTeamsTemplate: {
				{
					Name: "teams_uid",
					Data: listTeams(&ListTeamQuery{
						UID:        "abc",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "teams_page_1",
					Data: listTeams(&ListTeamQuery{
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "teams_page_2",
					Data: listTeams(&ListTeamQuery{
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryUsersTemplate: {
				{
					Name: "users_uid",
					Data: listUsers(&ListUserQuery{
						UID:        "abc",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "users_page_1",
					Data: listUsers(&ListUserQuery{
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "users_page_2",
					Data: listUsers(&ListUserQuery{
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryDisplayTemplate: {
				{
					Name: "display_uids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
					}),
				},
				{
					Name: "display_ids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						IDs:   []int64{1, 2},
					}),
				},
				{
					Name: "display_ids_uids",
					Data: getDisplay(&ListDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
						IDs:   []int64{1, 2},
					}),
				},
			},
			sqlQueryTeamBindingsTemplate: {
				{
					Name: "team_1_bindings",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID:      1,
						UID:        "team-1",
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_bindings_page_1",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID:      1,
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "team_bindings_page_2",
					Data: listTeamBindings(&ListTeamBindingsQuery{
						OrgID: 1,
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryTeamMembersTemplate: {
				{
					Name: "team_1_members_page_1",
					Data: listTeamMembers(&ListTeamMembersQuery{
						UID:        "team-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_1_members_page_2",
					Data: listTeamMembers(&ListTeamMembersQuery{
						UID:        "team-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1, Continue: 2},
					}),
				},
			},
			sqlQueryUserTeamsTemplate: {
				{
					Name: "team_1_members_page_1",
					Data: listUserTeams(&ListUserTeamsQuery{
						UserUID:    "user-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "team_1_members_page_2",
					Data: listUserTeams(&ListUserTeamsQuery{
						UserUID:    "user-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1, Continue: 2},
					}),
				},
			},
			sqlQueryUserInternalIDTemplate: {
				{
					Name: "user_internal_id",
					Data: &getUserInternalIDQuery{
						SQLTemplate:  mocks.NewTestingSQLTemplate(),
						UserTable:    nodb.Table("user"),
						OrgUserTable: nodb.Table("org_user"),
						Query: &GetUserInternalIDQuery{
							UID:   "user-1",
							OrgID: 1,
						},
					},
				},
			},
			sqlQueryTeamInternalIDTemplate: {
				{
					Name: "team_internal_id",
					Data: &getTeamInternalIDQuery{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						TeamTable:   nodb.Table("team"),
						Query: &GetTeamInternalIDQuery{
							UID:   "team-1",
							OrgID: 1,
						},
					},
				},
			},
			sqlQueryServiceAccountInternalIDTemplate: {
				{
					Name: "basic",
					Data: &getServiceAccountInternalIDQuery{
						SQLTemplate:  mocks.NewTestingSQLTemplate(),
						UserTable:    nodb.Table("user"),
						OrgUserTable: nodb.Table("org_user"),
						Query: &GetServiceAccountInternalIDQuery{
							OrgID: 1,
							UID:   "sa-1",
						},
					},
				},
			},
			sqlQueryServiceAccountsTemplate: {
				{
					Name: "service_accounts",
					Data: listServiceAccounts(&ListServiceAccountsQuery{
						UID:        "sa-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "service_accounts_page_1",
					Data: listServiceAccounts(&ListServiceAccountsQuery{
						OrgID:      1,
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "service_accounts_page_2",
					Data: listServiceAccounts(&ListServiceAccountsQuery{
						OrgID: 1,
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlQueryServiceAccountTokensTemplate: {
				{
					Name: "service_account_tokens",
					Data: listServiceAccountTokens(&ListServiceAccountTokenQuery{
						UID:        "sa-1",
						OrgID:      1,
						Pagination: common.Pagination{Limit: 1},
					}),
				},
				{
					Name: "service_account_tokens_page_1",
					Data: listServiceAccountTokens(&ListServiceAccountTokenQuery{
						OrgID:      1,
						Pagination: common.Pagination{Limit: 5},
					}),
				},
				{
					Name: "service_accounts_tokens_page_2",
					Data: listServiceAccountTokens(&ListServiceAccountTokenQuery{
						OrgID: 1,
						Pagination: common.Pagination{
							Limit:    1,
							Continue: 2,
						},
					}),
				},
			},
			sqlDeleteUserTemplate: {
				{
					Name: "delete_user_basic",
					Data: deleteUser(&DeleteUserCommand{
						OrgID: 1,
						UID:   "user-1",
					}),
				},
				{
					Name: "delete_user_different_org",
					Data: deleteUser(&DeleteUserCommand{
						OrgID: 2,
						UID:   "user-abc",
					}),
				},
			},
			sqlDeleteOrgUserTemplate: {
				{
					Name: "delete_org_user_basic",
					Data: deleteOrgUser(123),
				},
				{
					Name: "delete_org_user_different_id",
					Data: deleteOrgUser(456),
				},
			},
			sqlCreateOrgUserTemplate: {
				{
					Name: "create_org_user_basic",
					Data: createOrgUser(&CreateOrgUserCommand{
						OrgID:   1,
						UserID:  123,
						Role:    "Viewer",
						Created: NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
						Updated: NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
					}),
				},
				{
					Name: "create_org_user_admin",
					Data: createOrgUser(&CreateOrgUserCommand{
						OrgID:   2,
						UserID:  456,
						Role:    "Admin",
						Created: NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
						Updated: NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
					}),
				},
			},
			sqlCreateUserTemplate: {
				{
					Name: "create_user_basic",
					Data: createUser(&CreateUserCommand{
						UID:           "user-1",
						Email:         "user1@example.com",
						Login:         "user1",
						Name:          "User One",
						OrgID:         1,
						IsAdmin:       false,
						IsDisabled:    false,
						EmailVerified: true,
						IsProvisioned: false,
						Salt:          "randomsalt",
						Rands:         "randomrands",
						Created:       NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
						Updated:       NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
						LastSeenAt:    NewDBTime(time.Date(2013, 1, 1, 12, 0, 0, 0, time.UTC)),
						Role:          "Viewer",
					}),
				},
				{
					Name: "create_user_admin",
					Data: createUser(&CreateUserCommand{
						UID:           "admin-1",
						Email:         "admin@example.com",
						Login:         "admin",
						Name:          "Admin User",
						OrgID:         2,
						IsAdmin:       true,
						IsDisabled:    false,
						EmailVerified: true,
						IsProvisioned: true,
						Salt:          "adminsalt",
						Rands:         "adminrands",
						Created:       NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
						Updated:       NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
						LastSeenAt:    NewDBTime(time.Date(2013, 2, 1, 10, 30, 0, 0, time.UTC)),
						Role:          "Admin",
					}),
				},
			},
			sqlCreateServiceAccountTemplate: {
				{
					Name: "create_service_account_basic",
					Data: createServiceAccounts(&CreateServiceAccountCommand{
						UID:        "abcdef",
						Name:       "Service Account 1",
						Email:      "sa-1-service-account-1",
						Login:      "sa-1-service-account-1",
						IsDisabled: false,
						OrgID:      1,
						Created:    NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
						Updated:    NewDBTime(time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)),
						LastSeenAt: time.Date(2013, 1, 1, 12, 0, 0, 0, time.UTC),
					}),
				},
				{
					Name: "create_service_account_disabled",
					Data: createServiceAccounts(&CreateServiceAccountCommand{
						UID:        "abcdef",
						Name:       "Disabled Service Account",
						Email:      "sa-2-disabled-service-account",
						Login:      "sa-2-disabled-service-account",
						IsDisabled: true,
						OrgID:      2,
						Created:    NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
						Updated:    NewDBTime(time.Date(2023, 2, 1, 10, 30, 0, 0, time.UTC)),
						LastSeenAt: time.Date(2013, 2, 1, 10, 30, 0, 0, time.UTC),
					}),
				},
			},
		},
	})
}
