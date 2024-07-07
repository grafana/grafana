package sql

import (
	"embed"
	"encoding/json"
	"errors"
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// debug is meant to provide greater debugging detail about certain errors. The
// returned error will either provide more detailed information or be the same
// original error, suitable only for local debugging. The details provided are
// not meant to be logged, since they could include PII or otherwise
// sensitive/confidential information. These information should only be used for
// local debugging with fake or otherwise non-regulated information.
func debug(err error) error {
	var d interface{ Debug() string }
	if errors.As(err, &d) {
		return errors.New(d.Debug())
	}

	return err
}

var _ = debug // silence the `unused` linter

//go:embed testdata/*
var testdataFS embed.FS

func testdata(t *testing.T, filename string) []byte {
	t.Helper()
	b, err := testdataFS.ReadFile(`testdata/` + filename)
	require.NoError(t, err)

	return b
}

func testdataJSON(t *testing.T, filename string, dest any) {
	t.Helper()
	b := testdata(t, filename)
	err := json.Unmarshal(b, dest)
	require.NoError(t, err)
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
				Name: "insert into entity_history",
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
					Key:             &resource.ResourceKey{},
					resourceVersion: new(resourceVersion),
				},
				Expected: expected{
					"resource_version_get_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
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
					Key:         &resource.ResourceKey{},
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
					Key:         &resource.ResourceKey{},
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
								t.Run(d.Name(), func(t *testing.T) {
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

// func TestReadEntity(t *testing.T) {
// 	t.Parallel()

// 	// readonly, shared data for all subtests
// 	expectedEntity := newEmptyEntity()
// 	testdataJSON(t, `grpc-res-entity.json`, expectedEntity)
// 	key, err := grafanaregistry.ParseKey(expectedEntity.Key)
// 	require.NoErrorf(t, err, "provided key: %#v", expectedEntity)

// 	t.Run("happy path - entity table, optimistic locking", func(t *testing.T) {
// 		t.Parallel()

// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		x := expectReadEntity(t, mock, cloneEntity(expectedEntity))
// 		x(ctx, db)
// 	})

// 	t.Run("happy path - entity table, no optimistic locking", func(t *testing.T) {
// 		t.Parallel()

// 		// test declarations
// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		readReq := sqlEntityReadRequest{ // used to generate mock results
// 			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
// 			Key:              new(grafanaregistry.Key),
// 			returnsEntitySet: newReturnsEntitySet(),
// 		}
// 		readReq.Entity.Entity = cloneEntity(expectedEntity)
// 		results := newMockResults(t, mock, sqlEntityRead, readReq)

// 		// setup expectations
// 		results.AddCurrentData()
// 		mock.ExpectQuery(`select from entity where !resource_version update`).
// 			WillReturnRows(results.Rows())

// 		// execute and assert
// 		e, err := readEntity(ctx, db, sqltemplate.MySQL, key, 0, false, true)
// 		require.NoError(t, err)
// 		require.Equal(t, expectedEntity, e.Entity)
// 	})

// 	t.Run("happy path - entity_history table", func(t *testing.T) {
// 		t.Parallel()

// 		// test declarations
// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		readReq := sqlEntityReadRequest{ // used to generate mock results
// 			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
// 			Key:              new(grafanaregistry.Key),
// 			returnsEntitySet: newReturnsEntitySet(),
// 		}
// 		readReq.Entity.Entity = cloneEntity(expectedEntity)
// 		results := newMockResults(t, mock, sqlEntityRead, readReq)

// 		// setup expectations
// 		results.AddCurrentData()
// 		mock.ExpectQuery(`select from entity_history where resource_version !update`).
// 			WillReturnRows(results.Rows())

// 		// execute and assert
// 		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
// 			expectedEntity.ResourceVersion, false, false)
// 		require.NoError(t, err)
// 		require.Equal(t, expectedEntity, e.Entity)
// 	})

// 	t.Run("entity table, optimistic locking failed", func(t *testing.T) {
// 		t.Parallel()

// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		x := expectReadEntity(t, mock, nil)
// 		x(ctx, db)
// 	})

// 	t.Run("entity_history table, entity not found", func(t *testing.T) {
// 		t.Parallel()

// 		// test declarations
// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		readReq := sqlEntityReadRequest{ // used to generate mock results
// 			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
// 			Key:              new(grafanaregistry.Key),
// 			returnsEntitySet: newReturnsEntitySet(),
// 		}
// 		results := newMockResults(t, mock, sqlEntityRead, readReq)

// 		// setup expectations
// 		mock.ExpectQuery(`select from entity_history where resource_version !update`).
// 			WillReturnRows(results.Rows())

// 		// execute and assert
// 		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
// 			expectedEntity.ResourceVersion, false, false)
// 		require.Nil(t, e)
// 		require.Error(t, err)
// 		require.ErrorIs(t, err, ErrNotFound)
// 	})

// 	t.Run("entity_history table, entity was deleted = not found", func(t *testing.T) {
// 		t.Parallel()

// 		// test declarations
// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		readReq := sqlEntityReadRequest{ // used to generate mock results
// 			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
// 			Key:              new(grafanaregistry.Key),
// 			returnsEntitySet: newReturnsEntitySet(),
// 		}
// 		readReq.Entity.Entity = cloneEntity(expectedEntity)
// 		readReq.Entity.Entity.Action = entity.Entity_DELETED
// 		results := newMockResults(t, mock, sqlEntityRead, readReq)

// 		// setup expectations
// 		results.AddCurrentData()
// 		mock.ExpectQuery(`select from entity_history where resource_version !update`).
// 			WillReturnRows(results.Rows())

// 		// execute and assert
// 		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
// 			expectedEntity.ResourceVersion, false, false)
// 		require.Nil(t, e)
// 		require.Error(t, err)
// 		require.ErrorIs(t, err, ErrNotFound)
// 	})
// }

// // expectReadEntity arranges test expectations so that it's easier to reuse
// // across tests that need to call `readEntity`. If you provide a non-nil
// // *entity.Entity, that will be returned by `readEntity`. If it's nil, then
// // `readEntity` will return ErrOptimisticLockingFailed. It returns the function
// // to execute the actual test and assert the expectations that were set.
// func expectReadEntity(t *testing.T, mock sqlmock.Sqlmock, e *entity.Entity) func(ctx context.Context, db db.DB) {
// 	t.Helper()

// 	// test declarations
// 	readReq := sqlEntityReadRequest{ // used to generate mock results
// 		SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
// 		Key:              new(grafanaregistry.Key),
// 		returnsEntitySet: newReturnsEntitySet(),
// 	}
// 	results := newMockResults(t, mock, sqlEntityRead, readReq)
// 	if e != nil {
// 		readReq.Entity.Entity = cloneEntity(e)
// 	}

// 	// setup expectations
// 	results.AddCurrentData()
// 	mock.ExpectQuery(`select from entity where !resource_version update`).
// 		WillReturnRows(results.Rows())

// 	// execute and assert
// 	if e != nil {
// 		return func(ctx context.Context, db db.DB) {
// 			ent, err := readEntity(ctx, db, sqltemplate.MySQL, readReq.Key,
// 				e.ResourceVersion, true, true)
// 			require.NoError(t, err)
// 			require.Equal(t, e, ent.Entity)
// 		}
// 	}

// 	return func(ctx context.Context, db db.DB) {
// 		ent, err := readEntity(ctx, db, sqltemplate.MySQL, readReq.Key, 1, true,
// 			true)
// 		require.Nil(t, ent)
// 		require.Error(t, err)
// 		require.ErrorIs(t, err, ErrOptimisticLockingFailed)
// 	}
// }

// func TestKindVersionAtomicInc(t *testing.T) {
// 	t.Parallel()

// 	t.Run("happy path - row locked", func(t *testing.T) {
// 		t.Parallel()

// 		// test declarations
// 		const curVersion int64 = 1
// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)

// 		// setup expectations
// 		mock.ExpectQuery(`select resource_version from resource_version where group resource update`).
// 			WillReturnRows(mock.NewRows([]string{"resource_version"}).AddRow(curVersion))
// 		mock.ExpectExec("update resource_version set resource_version updated_at where group resource").
// 			WillReturnResult(sqlmock.NewResult(0, 1))

// 		// execute and assert
// 		gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
// 		require.NoError(t, err)
// 		require.Equal(t, curVersion+1, gotVersion)
// 	})

// 	t.Run("happy path - row created", func(t *testing.T) {
// 		t.Parallel()

// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		x := expectKindVersionAtomicInc(t, mock, false)
// 		x(ctx, db)
// 	})

// 	t.Run("fail to create row", func(t *testing.T) {
// 		t.Parallel()

// 		ctx := testutil.NewDefaultTestContext(t)
// 		db, mock := newMockDBMatchWords(t)
// 		x := expectKindVersionAtomicInc(t, mock, true)
// 		x(ctx, db)
// 	})
// }

// // expectKindVersionAtomicInc arranges test expectations so that it's easier to
// // reuse across tests that need to call `kindVersionAtomicInc`. If you the test
// // shuld fail, it will do so with `errTest`, and it will return resource version
// // 1 otherwise. It returns the function to execute the actual test and assert
// // the expectations that were set.
// func expectKindVersionAtomicInc(t *testing.T, mock sqlmock.Sqlmock, shouldFail bool) func(ctx context.Context, db db.DB) {
// 	t.Helper()

// 	// setup expectations
// 	mock.ExpectQuery(`select resource_version from resource_version where group resource update`).
// 		WillReturnRows(mock.NewRows([]string{"resource_version"}))
// 	call := mock.ExpectExec("insert resource_version resource_version")

// 	// execute and assert
// 	if shouldFail {
// 		call.WillReturnError(errTest)

// 		return func(ctx context.Context, db db.DB) {
// 			gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
// 			require.Zero(t, gotVersion)
// 			require.Error(t, err)
// 			require.ErrorIs(t, err, errTest)
// 		}
// 	}
// 	call.WillReturnResult(sqlmock.NewResult(0, 1))

// 	return func(ctx context.Context, db db.DB) {
// 		gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
// 		require.NoError(t, err)
// 		require.Equal(t, int64(1), gotVersion)
// 	}
// }

// func TestMustTemplate(t *testing.T) {
// 	t.Parallel()

// 	require.Panics(t, func() {
// 		mustTemplate("non existent file")
// 	})
// }

// // Debug provides greater detail about the SQL error. It is defined on the same
// // struct but on a test file so that the intention that its results should not
// // be used in runtime code is very clear. The results could include PII or
// // otherwise regulated information, hence this method is only available in
// // tests, so that it can be used in local debugging only. Note that the error
// // information may still be available through other means, like using the
// // "reflect" package, so care must be taken not to ever expose these information
// // in production.
// func (e SQLError) Debug() string {
// 	scanDestStr := "(none)"
// 	if len(e.ScanDest) > 0 {
// 		format := "[%T" + strings.Repeat(", %T", len(e.ScanDest)-1) + "]"
// 		scanDestStr = fmt.Sprintf(format, e.ScanDest...)
// 	}

// 	return fmt.Sprintf("%s: %s: %v\n\tArguments (%d): %#v\n\tReturn Value "+
// 		"Types (%d): %s\n\tExecuted Query: %s\n\tRaw SQL Template Output: %s",
// 		e.TemplateName, e.CallType, e.Err, len(e.arguments), e.arguments,
// 		len(e.ScanDest), scanDestStr, e.Query, e.RawQuery)
// }
