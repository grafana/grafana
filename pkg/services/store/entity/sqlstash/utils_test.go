package sqlstash

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"testing"
	"text/template"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	sqltemplateMocks "github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// newMockDBNopSQL returns a db.DB and a sqlmock.Sqlmock that doesn't validates
// SQL. This is only meant to be used to test wrapping utilities exec, query and
// queryRow, where the actual SQL is not relevant to the unit tests, but rather
// how the possible derived error conditions handled.
func newMockDBNopSQL(t *testing.T) (db.DB, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New(
		sqlmock.MonitorPingsOption(true),
		sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(
			func(expectedSQL, actualSQL string) error {
				return nil
			},
		)),
	)

	return newUnitTestDB(t, db, mock, err)
}

// newMockDBMatchWords returns a db.DB and a sqlmock.Sqlmock that will match SQL
// by splitting the expected SQL string into words, and then try to find all of
// them in the actual SQL, in the given order, case insensitively. Prepend a
// word with a `!` to say that word should not be found.
func newMockDBMatchWords(t *testing.T) (db.DB, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New(
		sqlmock.MonitorPingsOption(true),
		sqlmock.QueryMatcherOption(
			sqlmock.QueryMatcherFunc(func(expectedSQL, actualSQL string) error {
				actualSQL = strings.ToLower(sqltemplate.FormatSQL(actualSQL))
				expectedSQL = strings.ToLower(expectedSQL)

				var offset int
				for _, vv := range mockDBMatchWordsRE.FindAllStringSubmatch(expectedSQL, -1) {
					v := vv[1]

					var shouldNotMatch bool
					if v != "" && v[0] == '!' {
						v = v[1:]
						shouldNotMatch = true
					}
					if v == "" {
						return fmt.Errorf("invalid expected word %q in %q", v,
							expectedSQL)
					}

					reWord, err := regexp.Compile(`\b` + regexp.QuoteMeta(v) + `\b`)
					if err != nil {
						return fmt.Errorf("compile word %q from expected SQL: %s", v,
							expectedSQL)
					}

					if shouldNotMatch {
						if reWord.MatchString(actualSQL[offset:]) {
							return fmt.Errorf("actual SQL fragent should not cont"+
								"ain %q but it does\n\tFragment: %s\n\tFull SQL: %s",
								v, actualSQL[offset:], actualSQL)
						}
					} else {
						loc := reWord.FindStringIndex(actualSQL[offset:])
						if len(loc) == 0 {
							return fmt.Errorf("actual SQL fragment should contain "+
								"%q but it doesn't\n\tFragment: %s\n\tFull SQL: %s",
								v, actualSQL[offset:], actualSQL)
						}
						offset = loc[1] // advance the offset
					}
				}

				return nil
			},
			),
		),
	)

	return newUnitTestDB(t, db, mock, err)
}

var mockDBMatchWordsRE = regexp.MustCompile(`(?:\W|\A)(!?\w+)\b`)

func newUnitTestDB(t *testing.T, db *sql.DB, mock sqlmock.Sqlmock, err error) (db.DB, sqlmock.Sqlmock) {
	t.Helper()

	require.NoError(t, err)

	return dbimpl.NewDB(db, "sqlmock"), mock
}

// mockResults aids in testing code paths with queries returning large number of
// values, like those returning *entity.Entity. This is because we want to
// emulate returning the same row columns and row values the same as a real
// database would do. This utility the same template SQL that is expected to be
// used to help populate all the expected fields.
// fileds
type mockResults[T any] struct {
	t    *testing.T
	tmpl *template.Template
	data sqltemplate.WithResults[T]
	rows *sqlmock.Rows
}

// newMockResults returns a new *mockResults. If you want to emulate a call
// returning zero rows, then immediately call the Row method afterward.
func newMockResults[T any](t *testing.T, mock sqlmock.Sqlmock, tmpl *template.Template, data sqltemplate.WithResults[T]) *mockResults[T] {
	t.Helper()

	data.Reset()
	err := tmpl.Execute(io.Discard, data)
	require.NoError(t, err)
	rows := mock.NewRows(data.GetColNames())

	return &mockResults[T]{
		t:    t,
		tmpl: tmpl,
		data: data,
		rows: rows,
	}
}

// AddCurrentData uses the values contained in the `data` argument used during
// creation to populate a new expected row. It will access `data` with pointers,
// so you should replace the internal values of `data` with freshly allocated
// results to return different rows.
func (r *mockResults[T]) AddCurrentData() *mockResults[T] {
	r.t.Helper()

	r.data.Reset()
	err := r.tmpl.Execute(io.Discard, r.data)
	require.NoError(r.t, err)

	d := r.data.GetScanDest()
	dv := make([]driver.Value, len(d))
	for i, v := range d {
		dv[i] = v
	}
	r.rows.AddRow(dv...)

	return r
}

// Rows returns the *sqlmock.Rows object built.
func (r *mockResults[T]) Rows() *sqlmock.Rows {
	return r.rows
}

func TestCreateETag(t *testing.T) {
	t.Parallel()

	v := createETag(nil, nil, nil)
	require.Equal(t, "d41d8cd98f00b204e9800998ecf8427e", v)
}

func TestGetCurrentUser(t *testing.T) {
	t.Parallel()

	ctx := testutil.NewDefaultTestContext(t)
	username, err := getCurrentUser(ctx)
	require.NotEmpty(t, username)
	require.NoError(t, err)

	ctx = ctx.WithUser(nil)
	username, err = getCurrentUser(ctx)
	require.Empty(t, username)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrUserNotFoundInContext)
}

func TestPtrOr(t *testing.T) {
	t.Parallel()

	p := ptrOr[*int]()
	require.NotNil(t, p)
	require.Zero(t, *p)

	p = ptrOr[*int](nil, nil, nil, nil, nil, nil)
	require.NotNil(t, p)
	require.Zero(t, *p)

	v := 42
	v2 := 5
	p = ptrOr(nil, nil, nil, &v, nil, &v2, nil, nil)
	require.NotNil(t, p)
	require.Equal(t, v, *p)

	p = ptrOr(nil, nil, nil, &v)
	require.NotNil(t, p)
	require.Equal(t, v, *p)
}

func TestSliceOr(t *testing.T) {
	t.Parallel()

	p := sliceOr[[]int]()
	require.NotNil(t, p)
	require.Len(t, p, 0)

	p = sliceOr[[]int](nil, nil, nil, nil)
	require.NotNil(t, p)
	require.Len(t, p, 0)

	p = sliceOr([]int{}, []int{}, []int{}, []int{})
	require.NotNil(t, p)
	require.Len(t, p, 0)

	v := []int{1, 2}
	p = sliceOr([]int{}, nil, []int{}, v, nil, []int{}, []int{10}, nil)
	require.NotNil(t, p)
	require.Equal(t, v, p)

	p = sliceOr([]int{}, nil, []int{}, v)
	require.NotNil(t, p)
	require.Equal(t, v, p)
}

func TestMapOr(t *testing.T) {
	t.Parallel()

	p := mapOr[map[string]int]()
	require.NotNil(t, p)
	require.Len(t, p, 0)

	p = mapOr(nil, map[string]int(nil), nil, map[string]int{}, nil)
	require.NotNil(t, p)
	require.Len(t, p, 0)

	v := map[string]int{"a": 0, "b": 1}
	v2 := map[string]int{"c": 2, "d": 3}

	p = mapOr(nil, map[string]int(nil), v, v2, nil, map[string]int{}, nil)
	require.NotNil(t, p)
	require.Equal(t, v, p)

	p = mapOr(nil, map[string]int(nil), v)
	require.NotNil(t, p)
	require.Equal(t, v, p)
}

var (
	validTestTmpl   = template.Must(template.New("test").Parse("nothing special"))
	invalidTestTmpl = template.New("no definition should fail to exec")
	errTest         = errors.New("because of reasons")
)

// expectRows is a testing helper to keep mocks in sync when adding rows to a
// mocked SQL result. This is a helper to test `query` and `queryRow`.
type expectRows[T any] struct {
	*sqlmock.Rows
	ExpectedResults []T

	req *sqltemplateMocks.WithResults[T]
}

func newReturnsRow[T any](dbmock sqlmock.Sqlmock, req *sqltemplateMocks.WithResults[T]) *expectRows[T] {
	return &expectRows[T]{
		Rows: dbmock.NewRows(nil),
		req:  req,
	}
}

// Add adds a new value that should be returned by the `query` or `queryRow`
// operation.
func (r *expectRows[T]) Add(value T, err error) *expectRows[T] {
	r.req.EXPECT().GetScanDest().Return(nil).Once()
	r.req.EXPECT().Results().Return(value, err).Once()
	r.Rows.AddRow()
	r.ExpectedResults = append(r.ExpectedResults, value)

	return r
}

func TestQueryRow(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		db, dbmock := newMockDBNopSQL(t)
		rows := newReturnsRow(dbmock, req)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		dbmock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := queryRow(ctx, db, validTestTmpl, req)
		require.NoError(t, err)
		require.Equal(t, rows.ExpectedResults[0], res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		db, _ := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := queryRow(ctx, db, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		db, _ := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := queryRow(ctx, db, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing query", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		db, dbmock := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		dbmock.ExpectQuery("").WillReturnError(errTest)

		// execute and assert
		res, err := queryRow(ctx, db, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})
}

// scannerFunc is an adapter for the `scanner` interface.
type scannerFunc func(dest ...any) error

func (f scannerFunc) Scan(dest ...any) error {
	return f(dest...)
}

func TestScanRow(t *testing.T) {
	t.Parallel()

	const value int64 = 1

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		// test declarations
		req := sqltemplateMocks.NewWithResults[int64](t)
		sc := scannerFunc(func(dest ...any) error {
			return nil
		})

		// setup expectations
		req.EXPECT().GetScanDest().Return(nil).Once()
		req.EXPECT().Results().Return(value, nil).Once()

		// execute and assert
		res, err := scanRow(sc, req)
		require.NoError(t, err)
		require.Equal(t, value, res)
	})

	t.Run("scan error", func(t *testing.T) {
		t.Parallel()

		// test declarations
		req := sqltemplateMocks.NewWithResults[int64](t)
		sc := scannerFunc(func(dest ...any) error {
			return errTest
		})

		// setup expectations
		req.EXPECT().GetScanDest().Return(nil).Once()

		// execute and assert
		res, err := scanRow(sc, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})

	t.Run("results error", func(t *testing.T) {
		t.Parallel()

		// test declarations
		req := sqltemplateMocks.NewWithResults[int64](t)
		sc := scannerFunc(func(dest ...any) error {
			return nil
		})

		// setup expectations
		req.EXPECT().GetScanDest().Return(nil).Once()
		req.EXPECT().Results().Return(0, errTest).Once()

		// execute and assert
		res, err := scanRow(sc, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})
}

func TestExec(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		db, dbmock := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		dbmock.ExpectExec("").WillReturnResult(sqlmock.NewResult(0, 0))

		// execute and assert
		res, err := exec(ctx, db, validTestTmpl, req)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		db, _ := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := exec(ctx, db, invalidTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		db, _ := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := exec(ctx, db, invalidTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing SQL", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		db, dbmock := newMockDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		dbmock.ExpectExec("").WillReturnError(errTest)

		// execute and assert
		res, err := exec(ctx, db, validTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})
}
