package sql

import (
	"embed"
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

//go:embed testdata/*
var testdataFS embed.FS

func testdata(t *testing.T, filename string) []byte {
	t.Helper()
	b, err := testdataFS.ReadFile(`testdata/` + filename)
	require.NoError(t, err)

	return b
}

func TestQueries(t *testing.T) {
	t.Parallel()

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
		// type aliases to make code more semantic and self-documenting
		resultSQLFilename = string
		dialects          = []sqltemplate.Dialect
		expected          map[resultSQLFilename]dialects

		testCase = struct {
			Name string

			// Data should be the struct passed to the template.
			Data sqltemplate.SQLTemplateIface

			// Expected maps the filename containing the expected result query
			// to the list of dialects that would produce it. For simple
			// queries, it is possible that more than one dialect produce the
			// same output. The filename is expected to be in the `testdata`
			// directory.
			Expected expected
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
		sqlResourceDelete: {
			{
				Name: "single path",
				Data: &sqlResourceRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					WriteEvent: resource.WriteEvent{
						Key: &resource.ResourceKey{},
					},
				},
				Expected: expected{
					"resource_delete_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
					"resource_delete_postgres.sql": dialects{
						sqltemplate.PostgreSQL,
					},
				},
			},
		},

		sqlResourceInsert: {
			{
				Name: "insert into resource",
				Data: &sqlResourceRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					WriteEvent: resource.WriteEvent{
						Key: &resource.ResourceKey{},
					},
				},
				Expected: expected{
					"resource_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceUpdate: {
			{
				Name: "single path",
				Data: &sqlResourceRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					WriteEvent: resource.WriteEvent{
						Key: &resource.ResourceKey{},
					},
				},
				Expected: expected{
					"resource_update_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceRead: {
			{
				Name: "without resource version",
				Data: &sqlResourceReadRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Request: &resource.ReadRequest{
						Key: &resource.ResourceKey{},
					},
					readResponse: new(readResponse),
				},
				Expected: expected{
					"resource_read_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceList: {
			{
				Name: "filter on namespace",
				Data: &sqlResourceListRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Request: &resource.ListRequest{
						Limit: 10,
						Options: &resource.ListOptions{
							Key: &resource.ResourceKey{
								Namespace: "ns",
							},
						},
					},
					Response: new(resource.ResourceWrapper),
				},
				Expected: expected{
					"resource_list_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceHistoryList: {
			{
				Name: "single path",
				Data: &sqlResourceHistoryListRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Request: &historyListRequest{
						Limit: 10,
						Options: &resource.ListOptions{
							Key: &resource.ResourceKey{
								Namespace: "ns",
							},
						},
					},
					Response: new(resource.ResourceWrapper),
				},
				Expected: expected{
					"resource_history_list_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceUpdateRV: {
			{
				Name: "single path",
				Data: &sqlResourceUpdateRVRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
				},
				Expected: expected{
					"resource_update_rv_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceHistoryRead: {
			{
				Name: "single path",
				Data: &sqlResourceReadRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Request: &resource.ReadRequest{
						ResourceVersion: 123,
						Key:             &resource.ResourceKey{},
					},
					readResponse: new(readResponse),
				},
				Expected: expected{
					"resource_history_read_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceHistoryUpdateRV: {
			{
				Name: "single path",
				Data: &sqlResourceUpdateRVRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
				},
				Expected: expected{
					"resource_history_update_rv_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceHistoryInsert: {
			{
				Name: "insert into resource_history",
				Data: &sqlResourceRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					WriteEvent: resource.WriteEvent{
						Key: &resource.ResourceKey{},
					},
				},
				Expected: expected{
					"resource_history_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceVersionGet: {
			{
				Name: "single path",
				Data: &sqlResourceVersionRequest{
					SQLTemplate:     new(sqltemplate.SQLTemplate),
					resourceVersion: new(resourceVersion),
				},
				Expected: expected{
					"resource_version_get_mysql.sql": dialects{
						sqltemplate.MySQL,
					},
					"resource_version_get_sqlite.sql": dialects{
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceVersionInc: {
			{
				Name: "increment resource version",
				Data: &sqlResourceVersionRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					resourceVersion: &resourceVersion{
						ResourceVersion: 123,
					},
				},
				Expected: expected{
					"resource_version_inc_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlResourceVersionInsert: {
			{
				Name: "single path",
				Data: &sqlResourceVersionRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
				},
				Expected: expected{
					"resource_version_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
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

					for filename, ds := range tc.Expected {
						t.Run(filename, func(t *testing.T) {
							// not parallel because we're sharing tc.Data, not
							// worth it deep cloning

							rawQuery := string(testdata(t, filename))
							expectedQuery := sqltemplate.FormatSQL(rawQuery)

							for _, d := range ds {
								t.Run(d.DialectName(), func(t *testing.T) {
									// not parallel for the same reason

									tc.Data.SetDialect(d)
									err := tc.Data.Validate()
									require.NoError(t, err)
									got, err := sqltemplate.Execute(tmpl, tc.Data)
									require.NoError(t, err)
									got = sqltemplate.FormatSQL(got)
									require.Equal(t, expectedQuery, got)
								})
							}
						})
					}
				})
			}
		})
	}
}
