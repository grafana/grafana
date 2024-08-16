package legacy

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestQueries(t *testing.T) {
<<<<<<< HEAD
	t.Parallel()

	userTableValue := "grafana.user"
	teamTableValue := "grafana.team"
	orgUserTableValue := "grafana.org_user"

	// Check each dialect
	dialects := []sqltemplate.Dialect{
		sqltemplate.MySQL,
		sqltemplate.SQLite,
		sqltemplate.PostgreSQL,
	}

	// Each template has one or more test cases, each identified with a
	// descriptive name (e.g. "happy path", "error twiddling the frobb"). Each
	// of them will test that for the same input data they must produce a result
	// that will depend on the Dialect. Expected queries should be defined in
	// separate files in the testdata directory. This improves the testing
	// experience by separating test data from test code, since mixing both
	// tends to make it more difficult to reason about what is being done,
	// especially as we want testing code to scale and make it easy to add
	// tests.
	type (
		testCase = struct {
			Name string

			// Data should be the struct passed to the template.
			Data sqltemplate.SQLTemplateIface
		}
	)

	// Define tests cases. Most templates are trivial and testing that they
	// generate correct code for a single Dialect is fine, since the one thing
	// that always changes is how SQL placeholder arguments are passed (most
	// Dialects use `?` while PostgreSQL uses `$1`, `$2`, etc.), and that is
	// something that should be tested in the Dialect implementation instead of
	// here. We will ask to have at least one test per SQL template, and we will
	// lean to test MySQL. Templates containing branching (conditionals, loops,
	// etc.) should be exercised at least once in each of their branches.
	//
	// NOTE: in the Data field, make sure to have pointers populated to simulate
	// data is set as it would be in a real request. The data being correctly
	// populated in each case should be tested in integration tests, where the
	// data will actually flow to and from a real database. In this tests we
	// only care about producing the correct SQL.
	testCases := map[*template.Template][]*testCase{
		sqlQueryTeams: {
			{
				Name: "teams_uid",
				Data: &sqlQueryListTeams{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &ListTeamQuery{
						UID: "abc",
=======
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryTeams: {
				{
					Name: "teams_uid",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "teams_page_1",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "teams_page_2",
					Data: &sqlQueryListTeams{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListTeamQuery{
							ContinueID: 1,
							Limit:      2,
						},
>>>>>>> origin/main
					},
					TeamTable: teamTableValue,
				},
			},
			sqlQueryUsers: {
				{
					Name: "users_uid",
					Data: &sqlQueryListUsers{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							UID: "abc",
						},
					},
				},
				{
					Name: "users_page_1",
					Data: &sqlQueryListUsers{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							Limit: 5,
						},
					},
				},
				{
					Name: "users_page_2",
					Data: &sqlQueryListUsers{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &ListUserQuery{
							ContinueID: 1,
							Limit:      2,
						},
					},
					TeamTable: teamTableValue,
				},
			},
			sqlQueryDisplay: {
				{
					Name: "display_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
						},
					},
				},
				{
					Name: "display_ids",
					Data: &sqlQueryGetDisplay{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							IDs:   []int64{1, 2},
						},
					},
				},
				{
					Name: "display_ids_uids",
					Data: &sqlQueryGetDisplay{
						SQLTemplateIface: mocks.NewTestingSQLTemplate(),
						Query: &GetUserDisplayQuery{
							OrgID: 2,
							UIDs:  []string{"a", "b"},
							IDs:   []int64{1, 2},
						},
					},
					TeamTable: teamTableValue,
				},
			},
		},
<<<<<<< HEAD
		sqlQueryUsers: {
			{
				Name: "users_uid",
				Data: &sqlQueryListUsers{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &ListUserQuery{
						UID: "abc",
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
			{
				Name: "users_page_1",
				Data: &sqlQueryListUsers{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &ListUserQuery{
						Limit: 5,
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
			{
				Name: "users_page_2",
				Data: &sqlQueryListUsers{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &ListUserQuery{
						ContinueID: 1,
						Limit:      2,
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
		},
		sqlQueryDisplay: {
			{
				Name: "display_uids",
				Data: &sqlQueryGetDisplay{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &GetUserDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
			{
				Name: "display_ids",
				Data: &sqlQueryGetDisplay{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &GetUserDisplayQuery{
						OrgID: 2,
						IDs:   []int64{1, 2},
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
			{
				Name: "display_ids_uids",
				Data: &sqlQueryGetDisplay{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &GetUserDisplayQuery{
						OrgID: 2,
						UIDs:  []string{"a", "b"},
						IDs:   []int64{1, 2},
					},
					UserTable:    userTableValue,
					OrgUserTable: orgUserTableValue,
				},
			},
		},
	}

	// Execute test cases
	for tmpl, tcs := range testCases {
		t.Run(tmpl.Name(), func(t *testing.T) {
			t.Parallel()

			for _, tc := range tcs {
				t.Run(tc.Name, func(t *testing.T) {
					t.Parallel()

					for _, dialect := range dialects {
						filename := dialect.DialectName() + "__" + tc.Name + ".sql"
						t.Run(filename, func(t *testing.T) {
							// not parallel because we're sharing tc.Data, not
							// worth it deep cloning

							expectedQuery := string(testdata(t, filename))
							//expectedQuery := sqltemplate.FormatSQL(rawQuery)

							tc.Data.SetDialect(dialect)
							err := tc.Data.Validate()
							require.NoError(t, err)
							got, err := sqltemplate.Execute(tmpl, tc.Data)
							require.NoError(t, err)

							got = sqltemplate.RemoveEmptyLines(got)
							if diff := cmp.Diff(expectedQuery, got); diff != "" {
								writeTestData(filename, got)
								t.Errorf("%s: %s", tc.Name, diff)
							}
						})
					}
				})
			}
		})
	}
=======
	})
>>>>>>> origin/main
}
