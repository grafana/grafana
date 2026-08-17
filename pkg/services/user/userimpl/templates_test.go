package userimpl

import (
	"testing"
	"text/template"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
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

	searchQuery := func(includeAuthJoin bool, withFilters bool) *searchUsersQuery {
		query := &searchUsersQuery{
			SQLTemplate:      queryTemplate(),
			UserTable:        dbHelper.Table("user"),
			UserAuthTable:    dbHelper.Table("user_auth"),
			IsServiceAccount: false,
			AccessAll:        true,
			UseDefaultSort:   true,
			IncludeAuthJoin:  includeAuthJoin,
		}
		if withFilters {
			query.OrgID = 7
			query.AccessAll = false
			query.AccessUserIDs = []any{11, 12}
			query.QueryPattern = "%ops%"
			query.HasIsDisabled = true
			query.IsDisabled = true
			query.AuthModule = "oauth"
			query.Joins = []searchUserJoin{{
				Operator:  "INNER",
				Table:     dbHelper.Table("user_stats"),
				Alias:     "user_stats",
				Condition: "user_stats.user_id = u.id",
			}}
			query.Filters = []searchUserFilter{
				{
					Kind:      "in",
					Condition: "user_stats.billing_role",
					Values:    []any{"admin", "editor"},
				},
				{
					Kind: "where",
					Parts: []searchUserConditionPart{
						{SQL: "is_admin = "},
						{Value: true, HasValue: true},
					},
				},
			}
			query.Sorts = []string{"u.login DESC", "u.email ASC"}
			query.Limit = 25
			query.Offset = 50
		}
		return query
	}
	emptyInSearchQuery := searchQuery(true, false)
	emptyInSearchQuery.Filters = []searchUserFilter{{Kind: "in", Condition: "user_stats.billing_role"}}
	emptyInCountSearchQuery := searchQuery(true, false)
	emptyInCountSearchQuery.Filters = []searchUserFilter{{Kind: "in", Condition: "user_stats.billing_role"}}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			deleteUserTemplate: {
				{
					Name: "delete_user",
					Data: &deleteUserQuery{
						SQLTemplate: queryTemplate(),
						UserTable:   dbHelper.Table("user"),
						UserID:      42,
					},
				},
			},
			getUserByIDTemplate: {
				{
					Name: "user",
					Data: &getUserByIDQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						UserID:           42,
						IsServiceAccount: false,
					},
				},
			},
			getUserByLoginOrEmailTemplate: {
				{
					Name: "by_email",
					Data: &getUserByLoginOrEmailQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						Identifier:       "alice@example.com",
						ByEmail:          true,
						IsServiceAccount: false,
					},
				},
				{
					Name: "by_login",
					Data: &getUserByLoginOrEmailQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						Identifier:       "alice",
						IsServiceAccount: false,
					},
				},
			},
			getSignedInUserTemplate: {
				{
					Name: "by_id_with_org",
					Data: &signedInUserQuery{
						SQLTemplate:  queryTemplate(),
						UserTable:    dbHelper.Table("user"),
						OrgUserTable: dbHelper.Table("org_user"),
						OrgTable:     dbHelper.Table("org"),
						OrgID:        7,
						UserID:       42,
					},
				},
				{
					Name: "by_login_without_org",
					Data: &signedInUserQuery{
						SQLTemplate:  queryTemplate(),
						UserTable:    dbHelper.Table("user"),
						OrgUserTable: dbHelper.Table("org_user"),
						OrgTable:     dbHelper.Table("org"),
						Login:        "alice",
					},
				},
				{
					Name: "by_email",
					Data: &signedInUserQuery{
						SQLTemplate:  queryTemplate(),
						UserTable:    dbHelper.Table("user"),
						OrgUserTable: dbHelper.Table("org_user"),
						OrgTable:     dbHelper.Table("org"),
						OrgID:        7,
						Email:        "alice@example.com",
					},
				},
			},
			countUsersTemplate: {
				{
					Name: "users",
					Data: &countUsersQuery{
						SQLTemplate: queryTemplate(),
						UserTable:   dbHelper.Table("user"),
					},
				},
			},
			countUserAccountsWithEmptyRoleTemplate: {
				{
					Name: "empty_role",
					Data: &countUserAccountsWithEmptyRoleQuery{
						SQLTemplate:  queryTemplate(),
						OrgUserTable: dbHelper.Table("org_user"),
						UserTable:    dbHelper.Table("user"),
						Role:         "None",
					},
				},
			},
			batchDisableUsersTemplate: {
				{
					Name: "users",
					Data: &batchDisableUsersQuery{
						SQLTemplate: queryTemplate(),
						UserTable:   dbHelper.Table("user"),
						UserIDs:     []int64{11, 12, 13},
						IsDisabled:  true,
					},
				},
				{
					Name:            "empty_user_ids",
					ValidationError: "user IDs must not be empty",
					Data: &batchDisableUsersQuery{
						SQLTemplate: queryTemplate(),
						UserTable:   dbHelper.Table("user"),
					},
				},
			},
			searchUsersTemplate: {
				{Name: "all_filters", Data: searchQuery(true, true)},
				{Name: "default", Data: searchQuery(true, false)},
				{Name: "empty_in", Data: emptyInSearchQuery},
			},
			countSearchUsersTemplate: {
				{Name: "with_auth_filter", Data: searchQuery(true, true)},
				{Name: "without_auth_filter", Data: searchQuery(false, false)},
				{Name: "empty_in", Data: emptyInCountSearchQuery},
			},
			updateUserTemplate: {
				{
					Name: "all_fields",
					Data: &updateUserQuery{
						SQLTemplate:       queryTemplate(),
						UserTable:         dbHelper.Table("user"),
						UserID:            42,
						IsServiceAccount:  false,
						Email:             "alice@example.com",
						Name:              "Alice",
						Login:             "alice",
						Password:          "hashed-password",
						EmailVerified:     true,
						HasEmailVerified:  true,
						Theme:             "dark",
						IsDisabled:        false,
						HasIsDisabled:     true,
						IsGrafanaAdmin:    true,
						HasIsGrafanaAdmin: true,
						OrgID:             7,
						HasOrgID:          true,
						IsProvisioned:     false,
						HasIsProvisioned:  true,
						Updated:           legacysql.NewDBTime(time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)),
					},
				},
			},
		},
	})
}

func TestSearchUsersQueryArguments(t *testing.T) {
	query := searchUsersQuery{
		SQLTemplate:      sqltemplate.New(sqltemplate.PostgreSQL),
		UserTable:        "test_schema.user",
		UserAuthTable:    "test_schema.user_auth",
		IsServiceAccount: false,
		OrgID:            7,
		AccessUserIDs:    []any{11, 12},
		QueryPattern:     "%ops%",
		HasIsDisabled:    true,
		IsDisabled:       true,
		AuthModule:       "oauth",
		Filters: []searchUserFilter{
			{
				Kind:      "in",
				Condition: "user_stats.billing_role",
				Values:    []any{"admin", "editor"},
			},
			{
				Kind: "where",
				Parts: []searchUserConditionPart{
					{SQL: "is_admin = "},
					{Value: true, HasValue: true},
				},
			},
		},
		Limit:           25,
		Offset:          50,
		IncludeAuthJoin: true,
	}

	_, err := renderUserQuery(searchUsersTemplate, query)
	require.NoError(t, err)
	require.Equal(t, []any{
		false,
		int64(7),
		11,
		12,
		"%ops%",
		"%ops%",
		"%ops%",
		true,
		"oauth",
		"admin",
		"editor",
		true,
		25,
		50,
	}, query.GetArgs())
}

func TestUpdateUserQueryArguments(t *testing.T) {
	updated := legacysql.NewDBTime(time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC))
	query := updateUserQuery{
		SQLTemplate:       sqltemplate.New(sqltemplate.PostgreSQL),
		UserTable:         "test_schema.user",
		UserID:            42,
		IsServiceAccount:  false,
		Email:             "alice@example.com",
		Name:              "Alice",
		Login:             "alice",
		Password:          "hashed-password",
		EmailVerified:     true,
		HasEmailVerified:  true,
		Theme:             "dark",
		IsDisabled:        false,
		HasIsDisabled:     true,
		IsGrafanaAdmin:    true,
		HasIsGrafanaAdmin: true,
		OrgID:             7,
		HasOrgID:          true,
		IsProvisioned:     false,
		HasIsProvisioned:  true,
		Updated:           updated,
	}

	_, err := renderUserQuery(updateUserTemplate, query)
	require.NoError(t, err)
	require.Equal(t, []any{
		"alice@example.com",
		"Alice",
		"alice",
		"hashed-password",
		true,
		"dark",
		false,
		true,
		int64(7),
		false,
		updated,
		int64(42),
		false,
	}, query.GetArgs())
}

func TestSearchUserWhereFilterPreservesSliceValue(t *testing.T) {
	value := []int{1, 2}
	filter, err := newSearchUserWhereFilter("user_id = ?", value)
	require.NoError(t, err)
	require.Len(t, filter.Parts, 2)
	require.Equal(t, value, filter.Parts[1].Value)
}

func TestQueryValidation(t *testing.T) {
	require.ErrorIs(t, (&signedInUserQuery{}).Validate(), user.ErrNoUniqueID)
	require.ErrorContains(t, (&batchDisableUsersQuery{}).Validate(), "user IDs must not be empty")
	require.NoError(t, (&searchUsersQuery{Filters: []searchUserFilter{{Kind: "in"}}}).Validate())
}
