package sqlstash

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"text/template"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/testutil"
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
		sqlEntityDelete: {
			{
				Name: "single path",
				Data: &sqlEntityDeleteRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Key:         new(grafanaregistry.Key),
				},
				Expected: expected{
					"entity_delete_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
					"entity_delete_postgres.sql": dialects{
						sqltemplate.PostgreSQL,
					},
				},
			},
		},

		sqlEntityInsert: {
			{
				Name: "insert into entity",
				Data: &sqlEntityInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Entity:      newReturnsEntity(),
					TableEntity: true,
				},
				Expected: expected{
					"entity_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
			{
				Name: "insert into entity_history",
				Data: &sqlEntityInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Entity:      newReturnsEntity(),
					TableEntity: false,
				},
				Expected: expected{
					"entity_history_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlEntityListFolderElements: {
			{
				Name: "single path",
				Data: &sqlEntityListFolderElementsRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					FolderInfo:  new(folderInfo),
				},
				Expected: expected{
					"entity_list_folder_elements_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlEntityRead: {
			{
				Name: "with resource version and select for update",
				Data: &sqlEntityReadRequest{
					SQLTemplate:     new(sqltemplate.SQLTemplate),
					Key:             new(grafanaregistry.Key),
					ResourceVersion: 1,
					SelectForUpdate: true,
					returnsEntitySet: returnsEntitySet{
						Entity: newReturnsEntity(),
					},
				},
				Expected: expected{
					"entity_history_read_full_mysql.sql": dialects{
						sqltemplate.MySQL,
					},
				},
			},
			{
				Name: "without resource version and select for update",
				Data: &sqlEntityReadRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Key:         new(grafanaregistry.Key),
					returnsEntitySet: returnsEntitySet{
						Entity: newReturnsEntity(),
					},
				},
				Expected: expected{
					"entity_read_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlEntityUpdate: {
			{
				Name: "single path",
				Data: &sqlEntityUpdateRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Entity:      newReturnsEntity(),
				},
				Expected: expected{
					"entity_update_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlEntityFolderInsert: {
			{
				Name: "one item",
				Data: &sqlEntityFolderInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Items:       []*sqlEntityFolderInsertRequestItem{{}},
				},
				Expected: expected{
					"entity_folder_insert_1_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
					},
				},
			},
			{
				Name: "two items",
				Data: &sqlEntityFolderInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Items:       []*sqlEntityFolderInsertRequestItem{{}, {}},
				},
				Expected: expected{
					"entity_folder_insert_2_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
					},
				},
			},
		},

		sqlEntityLabelsDelete: {
			{
				Name: "one element",
				Data: &sqlEntityLabelsDeleteRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					KeepLabels:  []string{"one"},
				},
				Expected: expected{
					"entity_labels_delete_1_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
			{
				Name: "two elements",
				Data: &sqlEntityLabelsDeleteRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					KeepLabels:  []string{"one", "two"},
				},
				Expected: expected{
					"entity_labels_delete_2_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlEntityLabelsInsert: {
			{
				Name: "one element",
				Data: &sqlEntityLabelsInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Labels:      map[string]string{"lbl1": "val1"},
				},
				Expected: expected{
					"entity_labels_insert_1_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
			{
				Name: "two elements",
				Data: &sqlEntityLabelsInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
					Labels:      map[string]string{"lbl1": "val1", "lbl2": "val2"},
				},
				Expected: expected{
					"entity_labels_insert_2_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlKindVersionGet: {
			{
				Name: "single path",
				Data: &sqlKindVersionGetRequest{
					SQLTemplate:        new(sqltemplate.SQLTemplate),
					returnsKindVersion: new(returnsKindVersion),
				},
				Expected: expected{
					"kind_version_get_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlKindVersionInc: {
			{
				Name: "single path",
				Data: &sqlKindVersionIncRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
				},
				Expected: expected{
					"kind_version_inc_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlKindVersionInsert: {
			{
				Name: "single path",
				Data: &sqlKindVersionInsertRequest{
					SQLTemplate: new(sqltemplate.SQLTemplate),
				},
				Expected: expected{
					"kind_version_insert_mysql_sqlite.sql": dialects{
						sqltemplate.MySQL,
						sqltemplate.SQLite,
					},
				},
			},
		},

		sqlKindVersionLock: {
			{
				Name: "single path",
				Data: &sqlKindVersionLockRequest{
					SQLTemplate:        new(sqltemplate.SQLTemplate),
					returnsKindVersion: new(returnsKindVersion),
				},
				Expected: expected{
					"kind_version_lock_mysql.sql": dialects{
						sqltemplate.MySQL,
					},
					"kind_version_lock_postgres.sql": dialects{
						sqltemplate.PostgreSQL,
					},
					"kind_version_lock_sqlite.sql": dialects{
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

func TestReturnsEntity_marshal(t *testing.T) {
	t.Parallel()

	// test data for maps
	someMap := map[string]string{
		"alpha": "aleph",
		"beta":  "beth",
	}
	someMapJSONb, err := json.Marshal(someMap)
	require.NoError(t, err)
	someMapJSON := string(someMapJSONb)

	// test data for errors
	someErrors := []*entity.EntityErrorInfo{
		{
			Code:        1,
			Message:     "not cool",
			DetailsJson: []byte(`"nothing to add"`),
		},
	}
	someErrorsJSONb, err := json.Marshal(someErrors)
	require.NoError(t, err)
	someErrorsJSON := string(someErrorsJSONb)

	t.Run("happy path - nothing to marshal", func(t *testing.T) {
		t.Parallel()

		d := &returnsEntity{
			Entity: &entity.Entity{
				Labels: map[string]string{},
				Fields: map[string]string{},
				Errors: []*entity.EntityErrorInfo{},
			},
		}
		err := d.marshal()
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))

		// nil Go Object/Slice map to empty JSON Object/Array for consistency

		d.Entity = new(entity.Entity)
		err = d.marshal()
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))
	})

	t.Run("happy path - everything to marshal", func(t *testing.T) {
		t.Parallel()

		d := &returnsEntity{
			Entity: &entity.Entity{
				Labels: someMap,
				Fields: someMap,
				Errors: someErrors,
			},
		}
		err := d.marshal()
		require.NoError(t, err)

		require.JSONEq(t, someMapJSON, string(d.Labels))
		require.JSONEq(t, someMapJSON, string(d.Fields))
		require.JSONEq(t, someErrorsJSON, string(d.Errors))
	})

	// NOTE: the error path for serialization is apparently unreachable. If you
	// find a way to simulate a serialization error, consider raising awareness
	// of such case(s) and add the corresponding tests here
}

func TestReturnsEntity_unmarshal(t *testing.T) {
	t.Parallel()

	t.Run("happy path - nothing to unmarshal", func(t *testing.T) {
		t.Parallel()

		e := newReturnsEntity()
		err := e.unmarshal()
		require.NoError(t, err)
		require.NotNil(t, e.Entity.Labels)
		require.NotNil(t, e.Entity.Fields)
		require.NotNil(t, e.Entity.Errors)
	})

	t.Run("happy path - everything to unmarshal", func(t *testing.T) {
		t.Parallel()

		e := newReturnsEntity()
		e.Labels = []byte(`{}`)
		e.Fields = []byte(`{}`)
		e.Errors = []byte(`[]`)
		err := e.unmarshal()
		require.NoError(t, err)
		require.NotNil(t, e.Entity.Labels)
		require.NotNil(t, e.Entity.Fields)
		require.NotNil(t, e.Entity.Errors)
	})

	t.Run("fail to unmarshal", func(t *testing.T) {
		t.Parallel()

		var jsonInvalid = []byte(`.`)

		e := newReturnsEntity()
		e.Labels = jsonInvalid
		err := e.unmarshal()
		require.Error(t, err)
		require.ErrorContains(t, err, "labels")

		e = newReturnsEntity()
		e.Labels = nil
		e.Fields = jsonInvalid
		err = e.unmarshal()
		require.Error(t, err)
		require.ErrorContains(t, err, "fields")

		e = newReturnsEntity()
		e.Fields = nil
		e.Errors = jsonInvalid
		err = e.unmarshal()
		require.Error(t, err)
		require.ErrorContains(t, err, "errors")
	})
}

func TestReadEntity(t *testing.T) {
	t.Parallel()

	// readonly, shared data for all subtests
	expectedEntity := newEmptyEntity()
	testdataJSON(t, `grpc-res-entity.json`, expectedEntity)
	key, err := grafanaregistry.ParseKey(expectedEntity.Key)
	require.NoErrorf(t, err, "provided key: %#v", expectedEntity)

	t.Run("happy path - entity table, optimistic locking", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		x := expectReadEntity(t, mock, cloneEntity(expectedEntity))
		x(ctx, db)
	})

	t.Run("happy path - entity table, no optimistic locking", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		readReq := sqlEntityReadRequest{ // used to generate mock results
			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
			Key:              new(grafanaregistry.Key),
			returnsEntitySet: newReturnsEntitySet(),
		}
		readReq.Entity.Entity = cloneEntity(expectedEntity)
		results := newMockResults(t, mock, sqlEntityRead, readReq)

		// setup expectations
		results.AddCurrentData()
		mock.ExpectQuery(`select from entity where !resource_version update`).
			WillReturnRows(results.Rows())

		// execute and assert
		e, err := readEntity(ctx, db, sqltemplate.MySQL, key, 0, false, true)
		require.NoError(t, err)
		require.Equal(t, expectedEntity, e.Entity)
	})

	t.Run("happy path - entity_history table", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		readReq := sqlEntityReadRequest{ // used to generate mock results
			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
			Key:              new(grafanaregistry.Key),
			returnsEntitySet: newReturnsEntitySet(),
		}
		readReq.Entity.Entity = cloneEntity(expectedEntity)
		results := newMockResults(t, mock, sqlEntityRead, readReq)

		// setup expectations
		results.AddCurrentData()
		mock.ExpectQuery(`select from entity_history where resource_version !update`).
			WillReturnRows(results.Rows())

		// execute and assert
		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
			expectedEntity.ResourceVersion, false, false)
		require.NoError(t, err)
		require.Equal(t, expectedEntity, e.Entity)
	})

	t.Run("entity table, optimistic locking failed", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		x := expectReadEntity(t, mock, nil)
		x(ctx, db)
	})

	t.Run("entity_history table, entity not found", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		readReq := sqlEntityReadRequest{ // used to generate mock results
			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
			Key:              new(grafanaregistry.Key),
			returnsEntitySet: newReturnsEntitySet(),
		}
		results := newMockResults(t, mock, sqlEntityRead, readReq)

		// setup expectations
		mock.ExpectQuery(`select from entity_history where resource_version !update`).
			WillReturnRows(results.Rows())

		// execute and assert
		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
			expectedEntity.ResourceVersion, false, false)
		require.Nil(t, e)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("entity_history table, entity was deleted = not found", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		readReq := sqlEntityReadRequest{ // used to generate mock results
			SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
			Key:              new(grafanaregistry.Key),
			returnsEntitySet: newReturnsEntitySet(),
		}
		readReq.Entity.Entity = cloneEntity(expectedEntity)
		readReq.Entity.Entity.Action = entity.Entity_DELETED
		results := newMockResults(t, mock, sqlEntityRead, readReq)

		// setup expectations
		results.AddCurrentData()
		mock.ExpectQuery(`select from entity_history where resource_version !update`).
			WillReturnRows(results.Rows())

		// execute and assert
		e, err := readEntity(ctx, db, sqltemplate.MySQL, key,
			expectedEntity.ResourceVersion, false, false)
		require.Nil(t, e)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrNotFound)
	})
}

// expectReadEntity arranges test expectations so that it's easier to reuse
// across tests that need to call `readEntity`. If you provide a non-nil
// *entity.Entity, that will be returned by `readEntity`. If it's nil, then
// `readEntity` will return ErrOptimisticLockingFailed. It returns the function
// to execute the actual test and assert the expectations that were set.
func expectReadEntity(t *testing.T, mock sqlmock.Sqlmock, e *entity.Entity) func(ctx context.Context, db db.DB) {
	t.Helper()

	// test declarations
	readReq := sqlEntityReadRequest{ // used to generate mock results
		SQLTemplate:      sqltemplate.New(sqltemplate.MySQL),
		Key:              new(grafanaregistry.Key),
		returnsEntitySet: newReturnsEntitySet(),
	}
	results := newMockResults(t, mock, sqlEntityRead, readReq)
	if e != nil {
		readReq.Entity.Entity = cloneEntity(e)
	}

	// setup expectations
	results.AddCurrentData()
	mock.ExpectQuery(`select from entity where !resource_version update`).
		WillReturnRows(results.Rows())

	// execute and assert
	if e != nil {
		return func(ctx context.Context, db db.DB) {
			ent, err := readEntity(ctx, db, sqltemplate.MySQL, readReq.Key,
				e.ResourceVersion, true, true)
			require.NoError(t, err)
			require.Equal(t, e, ent.Entity)
		}
	}

	return func(ctx context.Context, db db.DB) {
		ent, err := readEntity(ctx, db, sqltemplate.MySQL, readReq.Key, 1, true,
			true)
		require.Nil(t, ent)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrOptimisticLockingFailed)
	}
}

func TestKindVersionAtomicInc(t *testing.T) {
	t.Parallel()

	t.Run("happy path - row locked", func(t *testing.T) {
		t.Parallel()

		// test declarations
		const curVersion int64 = 1
		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)

		// setup expectations
		mock.ExpectQuery(`select resource_version from kind_version where group resource update`).
			WillReturnRows(mock.NewRows([]string{"resource_version"}).AddRow(curVersion))
		mock.ExpectExec("update kind_version set resource_version updated_at where group resource").
			WillReturnResult(sqlmock.NewResult(0, 1))

		// execute and assert
		gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
		require.NoError(t, err)
		require.Equal(t, curVersion+1, gotVersion)
	})

	t.Run("happy path - row created", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		x := expectKindVersionAtomicInc(t, mock, false)
		x(ctx, db)
	})

	t.Run("fail to create row", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		db, mock := newMockDBMatchWords(t)
		x := expectKindVersionAtomicInc(t, mock, true)
		x(ctx, db)
	})
}

// expectKindVersionAtomicInc arranges test expectations so that it's easier to
// reuse across tests that need to call `kindVersionAtomicInc`. If you the test
// shuld fail, it will do so with `errTest`, and it will return resource version
// 1 otherwise. It returns the function to execute the actual test and assert
// the expectations that were set.
func expectKindVersionAtomicInc(t *testing.T, mock sqlmock.Sqlmock, shouldFail bool) func(ctx context.Context, db db.DB) {
	t.Helper()

	// setup expectations
	mock.ExpectQuery(`select resource_version from kind_version where group resource update`).
		WillReturnRows(mock.NewRows([]string{"resource_version"}))
	call := mock.ExpectExec("insert kind_version resource_version")

	// execute and assert
	if shouldFail {
		call.WillReturnError(errTest)

		return func(ctx context.Context, db db.DB) {
			gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
			require.Zero(t, gotVersion)
			require.Error(t, err)
			require.ErrorIs(t, err, errTest)
		}
	}
	call.WillReturnResult(sqlmock.NewResult(0, 1))

	return func(ctx context.Context, db db.DB) {
		gotVersion, err := kindVersionAtomicInc(ctx, db, sqltemplate.MySQL, "groupname", "resname")
		require.NoError(t, err)
		require.Equal(t, int64(1), gotVersion)
	}
}

func TestMustTemplate(t *testing.T) {
	t.Parallel()

	require.Panics(t, func() {
		mustTemplate("non existent file")
	})
}

// Debug provides greater detail about the SQL error. It is defined on the same
// struct but on a test file so that the intention that its results should not
// be used in runtime code is very clear. The results could include PII or
// otherwise regulated information, hence this method is only available in
// tests, so that it can be used in local debugging only. Note that the error
// information may still be available through other means, like using the
// "reflect" package, so care must be taken not to ever expose these information
// in production.
func (e SQLError) Debug() string {
	scanDestStr := "(none)"
	if len(e.ScanDest) > 0 {
		format := "[%T" + strings.Repeat(", %T", len(e.ScanDest)-1) + "]"
		scanDestStr = fmt.Sprintf(format, e.ScanDest...)
	}

	return fmt.Sprintf("%s: %s: %v\n\tArguments (%d): %#v\n\tReturn Value "+
		"Types (%d): %s\n\tExecuted Query: %s\n\tRaw SQL Template Output: %s",
		e.TemplateName, e.CallType, e.Err, len(e.arguments), e.arguments,
		len(e.ScanDest), scanDestStr, e.Query, e.RawQuery)
}
