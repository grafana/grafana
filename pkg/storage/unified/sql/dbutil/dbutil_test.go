package dbutil

import (
	"database/sql"
	"errors"
	"testing"
	"text/template"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	sqltemplateMocks "github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var (
	validTestTmpl   = template.Must(template.New("test").Parse("nothing special"))
	invalidTestTmpl = template.New("no definition should fail to exec")
	errTest         = errors.New("because of reasons")
)

func TestSQLError(t *testing.T) {
	t.Parallel()

	const hiddenMessage = "obey, consume"

	var err error = SQLError{
		Err:          errTest,
		CallType:     "Exec",
		TemplateName: "some.sql",
		Query:        "SELECT name FROM movies WHERE quote LIKE ?",
		RawQuery:     "SELECT name FROM movies WHERE quote LIKE ?",
		ScanDest:     []any{new(string)},
		arguments:    []any{hiddenMessage},
	}

	require.Error(t, err)
	require.ErrorIs(t, err, errTest)
	require.NotContains(t, err.Error(), hiddenMessage)

	err = Debug(err)
	require.Error(t, err)
	require.Contains(t, err.Error(), hiddenMessage)

	err = Debug(errTest)
	require.Error(t, err)
	require.ErrorIs(t, err, errTest)
}

// expectRows is a testing helper to keep mocks in sync when adding rows to a
// mocked SQL result.
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

// Add adds a new value that should be returned by the `Query` or `QueryRow`
// operation.
func (r *expectRows[T]) Add(value T, err error) *expectRows[T] {
	r.req.EXPECT().GetScanDest().Return(nil).Once()
	r.req.EXPECT().Results().Return(value, err).Once()
	r.AddRow()
	r.ExpectedResults = append(r.ExpectedResults, value)

	return r
}

func TestQuery(t *testing.T) {
	t.Parallel()

	t.Run("happy path - no rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rdb.SQLMock.NewRows(nil))

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.Zero(t, res)
	})

	t.Run("happy path - multiple rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		rows.Add(2, nil)
		rows.Add(3, nil)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.NotZero(t, res)
		require.Equal(t, rows.ExpectedResults, res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := Query(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		res, err := Query(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing query", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnError(errTest)

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})

	t.Run("error decoding row", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(0, errTest)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "scan value")
	})

	t.Run("error iterating rows", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.AddRow() // we don't expect GetScanDest or Results here
		rows.RowError(0, errTest)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "closing rows")
	})

	t.Run("too many result sets", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows1 := newReturnsRow(rdb.SQLMock, req)
		rows2 := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows1.Add(1, nil)
		rows2.AddRow() // we don't expect GetScanDest or Results here
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows1.Rows, rows2.Rows)

		// execute and assert
		res, err := Query(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "too many result sets")
	})
}

func TestQueryRow(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := QueryRow(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.Equal(t, rows.ExpectedResults[0], res)
	})

	t.Run("no rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rdb.SQLMock.NewRows(nil))

		// execute and assert
		res, err := QueryRow(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorIs(t, err, sql.ErrNoRows)
	})

	t.Run("error executing query", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnError(errTest)

		// execute and assert
		res, err := QueryRow(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})

	t.Run("too many rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		rows.Add(2, nil)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := QueryRow(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "expecting a single row")
	})

	t.Run("too many result sets", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewDBProviderNopSQL(t)
		rows1 := newReturnsRow(rdb.SQLMock, req)
		rows2 := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows1.Add(1, nil)
		rows2.AddRow() // we don't expect GetScanDest or Results here
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows1.Rows, rows2.Rows)

		// execute and assert
		res, err := QueryRow(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "too many result sets")
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
		req := sqltemplateMocks.NewSQLTemplate(t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rdb.SQLMock.ExpectExec("").WillReturnResult(sqlmock.NewResult(0, 0))

		// execute and assert
		res, err := Exec(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.NotZero(t, res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplate(t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := Exec(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplate(t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := Exec(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing SQL", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplate(t)
		rdb := test.NewDBProviderNopSQL(t)

		// setup expectations
		req.EXPECT().DialectName().Return("test").Maybe()
		req.EXPECT().GetColNames().Return(nil).Maybe()
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		rdb.SQLMock.ExpectExec("").WillReturnError(errTest)

		// execute and assert
		res, err := Exec(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})
}
