package sql

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"testing"
	"text/template"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	sqltemplateMocks "github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestBackend_IsHealthy(t *testing.T) {
	t.Parallel()

	mockDB, mock, err := sqlmock.New(
		sqlmock.MonitorPingsOption(true),
	)
	require.NoError(t, err)
	rdb := test.TestResourceDB{
		DB:      dbimpl.NewDB(mockDB, db.DriverMySQL),
		SQLMock: mock,
	}

	b, err := NewBackend(BackendOptions{DB: rdb})
	require.NoError(t, err)
	require.NotNil(t, rdb.DB)
	rdb.SQLMock.ExpectPing().WillReturnError(nil) // ping in Init

	ctx := testutil.NewDefaultTestContext(t)
	rdb.SQLMock.ExpectPing().WillReturnError(nil)
	res, err := b.IsHealthy(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, res)

	rdb.SQLMock.ExpectPing().WillReturnError(errTest)
	res, err = b.IsHealthy(ctx, nil)
	require.Nil(t, res)
	require.Error(t, err)
	require.ErrorIs(t, err, errTest)
}

// mockResults aids in testing code paths with queries returning large number of
// values. This is because we want to emulate returning the same row columns and
// row values the same as a real database would do. This utility the same
// template SQL that is expected to be used to help populate all the expected
// fields.
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

func TestQuery(t *testing.T) {
	t.Parallel()

	t.Run("happy path - no rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnError(sql.ErrNoRows)

		// execute and assert
		res, err := query(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Len(t, res, 0)
	})

	t.Run("happy path - multiple rows returned", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		rows.Add(2, nil)
		rows.Add(3, nil)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := query(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Equal(t, rows.ExpectedResults, res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := query(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := query(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing query", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnError(errTest)

		// execute and assert
		res, err := query(ctx, rdb.DB, validTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})

	t.Run("error decoding row", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(0, errTest)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := query(ctx, rdb.DB, validTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "scan value")
	})

	t.Run("error iterating rows", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Rows.AddRow()
		rows.Rows.RowError(0, errTest)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := query(ctx, rdb.DB, validTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "rows error after reading")
	})
}

func TestQueryRow(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)
		rows := newReturnsRow(rdb.SQLMock, req)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rows.Add(1, nil)
		rdb.SQLMock.ExpectQuery("").WillReturnRows(rows.Rows)

		// execute and assert
		res, err := queryRow(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.Equal(t, rows.ExpectedResults[0], res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := queryRow(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := queryRow(ctx, rdb.DB, invalidTestTmpl, req)
		require.Zero(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing query", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewWithResults[int64](t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		req.EXPECT().GetScanDest().Return(nil).Maybe()
		rdb.SQLMock.ExpectQuery("").WillReturnError(errTest)

		// execute and assert
		res, err := queryRow(ctx, rdb.DB, validTestTmpl, req)
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
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil).Once()
		rdb.SQLMock.ExpectExec("").WillReturnResult(sqlmock.NewResult(0, 0))

		// execute and assert
		res, err := exec(ctx, rdb.DB, validTestTmpl, req)
		require.NoError(t, err)
		require.NotNil(t, res)
	})

	t.Run("invalid request", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(errTest).Once()

		// execute and assert
		res, err := exec(ctx, rdb.DB, invalidTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "invalid request")
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()

		// execute and assert
		res, err := exec(ctx, rdb.DB, invalidTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorContains(t, err, "execute template")
	})

	t.Run("error executing SQL", func(t *testing.T) {
		t.Parallel()

		// test declarations
		ctx := testutil.NewDefaultTestContext(t)
		req := sqltemplateMocks.NewSQLTemplateIface(t)
		rdb := test.NewResourceDBNopSQL(t)

		// setup expectations
		req.EXPECT().Validate().Return(nil).Once()
		req.EXPECT().GetArgs().Return(nil)
		rdb.SQLMock.ExpectExec("").WillReturnError(errTest)

		// execute and assert
		res, err := exec(ctx, rdb.DB, validTestTmpl, req)
		require.Nil(t, res)
		require.Error(t, err)
		require.ErrorAs(t, err, new(SQLError))
	})
}
