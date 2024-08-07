package legacy

import (
	"embed"
	"os"
	"path/filepath"
	"testing"
	"text/template"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed testdata/*
var testdataFS embed.FS

func testdata(t *testing.T, filename string) []byte {
	t.Helper()
	b, err := testdataFS.ReadFile(`testdata/` + filename)
	if err != nil {
		writeTestData(filename, "<empty>")
		assert.Fail(t, "missing test file")
	}
	return b
}

func writeTestData(filename, value string) {
	_ = os.WriteFile(filepath.Join("testdata", filename), []byte(value), 0777)
}

func TestQueries(t *testing.T) {
	t.Parallel()

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
		sqlQueryDashboards: {
			{
				Name: "history_uid",
				Data: &sqlQuery{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &DashboardQuery{
						OrgID: 2,
						UID:   "UUU",
					},
				},
			},
			{
				Name: "history_uid_at_version",
				Data: &sqlQuery{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &DashboardQuery{
						OrgID:   2,
						UID:     "UUU",
						Version: 3,
					},
				},
			},
			{
				Name: "history_uid_second_page",
				Data: &sqlQuery{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &DashboardQuery{
						OrgID:  2,
						UID:    "UUU",
						LastID: 7,
					},
				},
			},
			{
				Name: "dashboard",
				Data: &sqlQuery{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &DashboardQuery{
						OrgID: 2,
					},
				},
			},
			{
				Name: "dashboard_next_page",
				Data: &sqlQuery{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Query: &DashboardQuery{
						OrgID:  2,
						LastID: 22,
					},
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
}
