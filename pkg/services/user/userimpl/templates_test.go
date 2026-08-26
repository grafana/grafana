package userimpl

import (
	"testing"
	"text/template"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/util/xorm"
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

	searchQuery := func(withFilters bool) *searchUsersQuery {
		query := &searchUsersQuery{
			SQLTemplate:   queryTemplate(),
			UserTable:     dbHelper.Table("user"),
			UserAuthTable: dbHelper.Table("user_auth"),
			AccessAll:     true,
			OrderBy:       "u.login ASC, u.email ASC",
		}
		if withFilters {
			query.OrgID = 7
			query.AccessAll = false
			query.AccessUserIDs = []any{11, 12}
			query.QueryPattern = "%ops%"
			query.IsDisabled = new(true)
			query.AuthModule = "oauth"
			query.Joins = []searchUserJoin{{
				Operator:  "INNER",
				Table:     dbHelper.Table("user_stats"),
				Alias:     "user_stats",
				Condition: "user_stats.user_id = u.id",
			}}
			query.InFilters = []searchUserInFilter{
				{
					Condition: "user_stats.billing_role",
					Values:    []any{"admin", "editor"},
				},
			}
			query.WhereFilters = []searchUserWhereFilter{
				{
					Condition: "is_admin = ?",
					Params:    true,
					HasParams: true,
				},
			}
			query.OrderBy = "u.login DESC, u.email ASC"
			query.Limit = 25
			query.Offset = 50
		}
		return query
	}
	emptyInSearchQuery := searchQuery(false)
	emptyInSearchQuery.InFilters = []searchUserInFilter{{Condition: "user_stats.billing_role", Values: []any{}}}

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
			getUserTemplate: {
				{
					Name: "by_id",
					Data: &getUserQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						Identifier:       int64(42),
						IdentifierColumn: userIDColumn,
					},
				},
				{
					Name: "by_email",
					Data: &getUserQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						Identifier:       "alice@example.com",
						IdentifierColumn: userEmailColumn,
					},
				},
				{
					Name: "by_login",
					Data: &getUserQuery{
						SQLTemplate:      queryTemplate(),
						UserTable:        dbHelper.Table("user"),
						Identifier:       "alice",
						IdentifierColumn: userLoginColumn,
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
				{Name: "all_filters", Data: searchQuery(true)},
				{Name: "default", Data: searchQuery(false)},
				{Name: "empty_in", Data: emptyInSearchQuery},
			},
			countSearchUsersTemplate: {
				{Name: "with_auth_filter", Data: searchQuery(true)},
				{Name: "without_auth_filter", Data: searchQuery(false)},
			},
			updateUserTemplate: {
				{
					Name: "all_fields",
					Data: &updateUserQuery{
						SQLTemplate:    queryTemplate(),
						UserTable:      dbHelper.Table("user"),
						UserID:         42,
						Email:          "alice@example.com",
						Name:           "Alice",
						Login:          "alice",
						Password:       new(user.Password("hashed-password")),
						EmailVerified:  new(true),
						Theme:          "dark",
						IsDisabled:     new(false),
						IsGrafanaAdmin: new(true),
						OrgID:          new(int64(7)),
						IsProvisioned:  new(false),
						Updated:        legacysql.NewDBTime(time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)),
					},
				},
			},
		},
	})
}

func TestSearchUsersQueryArguments(t *testing.T) {
	query := searchUsersQuery{
		SQLTemplate:   sqltemplate.New(sqltemplate.PostgreSQL),
		UserTable:     "test_schema.user",
		UserAuthTable: "test_schema.user_auth",
		OrgID:         7,
		AccessUserIDs: []any{11, 12},
		QueryPattern:  "%ops%",
		IsDisabled:    new(true),
		AuthModule:    "oauth",
		OrderBy:       "u.login ASC, u.email ASC",
		InFilters: []searchUserInFilter{
			{
				Condition: "user_stats.billing_role",
				Values:    []any{"admin", "editor"},
			},
		},
		WhereFilters: []searchUserWhereFilter{
			{
				Condition: "is_admin = ?",
				Params:    true,
				HasParams: true,
			},
		},
		Limit:  25,
		Offset: 50,
	}

	_, err := renderUserQuery(searchUsersTemplate, query)
	require.NoError(t, err)
	require.Equal(t, []any{
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
		SQLTemplate:    sqltemplate.New(sqltemplate.PostgreSQL),
		UserTable:      "test_schema.user",
		UserID:         42,
		Email:          "alice@example.com",
		Name:           "Alice",
		Login:          "alice",
		Password:       new(user.Password("hashed-password")),
		EmailVerified:  new(true),
		Theme:          "dark",
		IsDisabled:     new(false),
		IsGrafanaAdmin: new(true),
		OrgID:          new(int64(7)),
		IsProvisioned:  new(false),
		Updated:        updated,
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
	}, query.GetArgs())
}

func TestSearchUserWhereFilterPreservesSliceValue(t *testing.T) {
	value := []int{1, 2}
	filter, err := newSearchUserWhereFilter("user_id = ?", value)
	require.NoError(t, err)
	require.Equal(t, "user_id = ?", filter.Condition)
	require.Equal(t, value, filter.Params)
	require.True(t, filter.HasParams)
}

func TestSearchUserWhereFilterRendersTrailingSQLAfterValue(t *testing.T) {
	filter, err := newSearchUserWhereFilter("created > ? AND is_disabled = FALSE", false)
	require.NoError(t, err)

	query := searchUsersQuery{
		SQLTemplate:   sqltemplate.New(sqltemplate.PostgreSQL),
		UserTable:     "test_schema.user",
		UserAuthTable: "test_schema.user_auth",
		AccessAll:     true,
		OrderBy:       "u.login ASC, u.email ASC",
		WhereFilters:  []searchUserWhereFilter{filter},
	}
	rawSQL, err := renderUserQuery(searchUsersTemplate, query)
	require.NoError(t, err)
	require.Contains(t, sqltemplate.FormatSQL(rawSQL), "AND created > $1 AND is_disabled = FALSE")
	require.Equal(t, []any{false}, query.GetArgs())
}

type testSearchUserFilter struct {
	where *user.WhereCondition
	in    *user.InCondition
	join  *user.JoinCondition
}

func (f testSearchUserFilter) WhereCondition() *user.WhereCondition {
	return f.where
}

func (f testSearchUserFilter) InCondition() *user.InCondition {
	return f.in
}

func (f testSearchUserFilter) JoinCondition() *user.JoinCondition {
	return f.join
}

type searchUserFilterTestDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *searchUserFilterTestDB) GetEngine() *xorm.Engine {
	return d.engine
}

func TestBuildSearchUserFilters(t *testing.T) {
	dbTimeZone := time.FixedZone("database", 2*60*60)
	whereTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.FixedZone("input", -5*60*60))
	dbHelper := &legacysql.LegacyDatabaseHelper{
		DB: &searchUserFilterTestDB{engine: &xorm.Engine{DatabaseTZ: dbTimeZone}},
		Table: func(name string) string {
			return "test_schema." + name
		},
	}

	joins, inFilters, whereFilters, err := buildSearchUserFilters(dbHelper, []user.Filter{
		testSearchUserFilter{
			join: &user.JoinCondition{
				Operator: "INNER",
				Table:    "user_stats",
				Params:   "user_stats.user_id = u.id",
			},
			in: &user.InCondition{
				Condition: "user_stats.billing_role",
				Params:    []string{"admin", "editor"},
			},
			where: &user.WhereCondition{
				Condition: "is_admin = ?",
				Params:    whereTime,
			},
		},
	})

	require.NoError(t, err)
	require.Equal(t, []searchUserJoin{{
		Operator:  "INNER",
		Table:     "test_schema.user_stats",
		Alias:     "user_stats",
		Condition: "user_stats.user_id = u.id",
	}}, joins)
	require.Equal(t, []searchUserInFilter{
		{
			Condition: "user_stats.billing_role",
			Values:    []any{"admin", "editor"},
		},
	}, inFilters)
	require.Equal(t, []searchUserWhereFilter{
		{
			Condition: "is_admin = ?",
			Params:    legacysql.NewDBTime(whereTime.In(dbTimeZone)),
			HasParams: true,
		},
	}, whereFilters)
}

func TestBuildSearchUserFiltersRejectsMalformedWhereCondition(t *testing.T) {
	joins, inFilters, whereFilters, err := buildSearchUserFilters(&legacysql.LegacyDatabaseHelper{}, []user.Filter{
		testSearchUserFilter{where: &user.WhereCondition{
			Condition: "is_admin = ? AND is_disabled = ?",
			Params:    true,
		}},
	})

	require.Nil(t, joins)
	require.Nil(t, inFilters)
	require.Nil(t, whereFilters)
	require.ErrorContains(t, err, "search filter condition must have one placeholder")
}

func TestQueryValidation(t *testing.T) {
	require.ErrorIs(t, (&signedInUserQuery{}).Validate(), user.ErrNoUniqueID)
	require.ErrorContains(t, (&batchDisableUsersQuery{}).Validate(), "user IDs must not be empty")
	require.ErrorContains(t, (&getUserQuery{}).Validate(), "invalid user identifier column")
	require.NoError(t, (&searchUsersQuery{WhereFilters: []searchUserWhereFilter{{Condition: "is_admin = FALSE"}}}).Validate())
}

func TestSearchUserOffset(t *testing.T) {
	require.Equal(t, 0, searchUserOffset(25, 0))
	require.Equal(t, 25, searchUserOffset(25, 2))
	require.Equal(t, 0, searchUserOffset(0, 2))
	require.Equal(t, 0, searchUserOffset(25, -1))
	require.Equal(t, 0, searchUserOffset(1<<40, 1<<40))
}
