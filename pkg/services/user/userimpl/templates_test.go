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
