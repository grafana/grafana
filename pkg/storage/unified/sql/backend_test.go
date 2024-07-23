package sql

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var (
	errTest = errors.New("things happened")
	resKey  = &resource.ResourceKey{
		Namespace: "ns",
		Group:     "gr",
		Resource:  "rs",
		Name:      "nm",
	}
)

type (
	Cols = []string         // column names
	Rows = [][]driver.Value // row values returned
)

type testBackend struct {
	*backend
	test.TestDBProvider
}

func (b testBackend) ExecWithResult(expectedSQL string) {
	b.SQLMock.ExpectExec(expectedSQL).WillReturnResult(sqlmock.NewResult(0, 0))
}

func (b testBackend) ExecWithErr(expectedSQL string, err error) {
	b.SQLMock.ExpectExec(expectedSQL).WillReturnError(err)
}

func (b testBackend) QueryWithResult(expectedSQL string, numCols int, rs Rows) {
	rows := b.SQLMock.NewRows(make([]string, numCols))
	if len(rs) > 0 {
		rows = rows.AddRows(rs...)
	}
	b.SQLMock.ExpectQuery(expectedSQL).WillReturnRows(rows)
}

func (b testBackend) QueryWithErr(expectedSQL string, err error) {
	b.SQLMock.ExpectQuery(expectedSQL).WillReturnError(err)
}

func setupBackendTest(t *testing.T) (testBackend, context.Context) {
	t.Helper()

	ctx := testutil.NewDefaultTestContext(t)
	dbp := test.NewDBProviderMatchWords(t)
	b, err := NewBackend(BackendOptions{DBProvider: dbp})
	require.NoError(t, err)
	require.NotNil(t, b)

	err = b.Init(ctx)
	require.NoError(t, err)

	bb, ok := b.(*backend)
	require.True(t, ok)
	require.NotNil(t, bb)

	return testBackend{
		backend:        bb,
		TestDBProvider: dbp,
	}, ctx
}

func TestNewBackend(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		dbp := test.NewDBProviderNopSQL(t)
		b, err := NewBackend(BackendOptions{DBProvider: dbp})
		require.NoError(t, err)
		require.NotNil(t, b)
	})

	t.Run("no db provider", func(t *testing.T) {
		t.Parallel()

		b, err := NewBackend(BackendOptions{})
		require.Nil(t, b)
		require.Error(t, err)
		require.ErrorContains(t, err, "no db provider")
	})
}

func TestBackend_Init(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		dbp := test.NewDBProviderWithPing(t)
		b, err := NewBackend(BackendOptions{DBProvider: dbp})
		require.NoError(t, err)
		require.NotNil(t, b)

		dbp.SQLMock.ExpectPing().WillReturnError(nil)
		err = b.Init(ctx)
		require.NoError(t, err)

		// if it isn't idempotent, then it will make a second ping and the
		// expectation will fail
		err = b.Init(ctx)
		require.NoError(t, err, "should be idempotent")

		err = b.Stop(ctx)
		require.NoError(t, err)
	})

	t.Run("no db provider", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		dbp := test.TestDBProvider{
			Err: errTest,
		}
		b, err := NewBackend(BackendOptions{DBProvider: dbp})
		require.NoError(t, err)
		require.NotNil(t, b)

		err = b.Init(ctx)
		require.Error(t, err)
		require.ErrorContains(t, err, "initialize resource DB")
	})

	t.Run("no dialect for driver", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		mockDB, _, err := sqlmock.New()
		require.NoError(t, err)
		dbp := test.TestDBProvider{
			DB: dbimpl.NewDB(mockDB, "juancarlo"),
		}

		b, err := NewBackend(BackendOptions{DBProvider: dbp})
		require.NoError(t, err)
		require.NotNil(t, b)

		err = b.Init(ctx)
		require.Error(t, err)
		require.ErrorContains(t, err, "no dialect for driver")
	})

	t.Run("database unreachable", func(t *testing.T) {
		t.Parallel()

		ctx := testutil.NewDefaultTestContext(t)
		dbp := test.NewDBProviderWithPing(t)
		b, err := NewBackend(BackendOptions{DBProvider: dbp})
		require.NoError(t, err)
		require.NotNil(t, dbp.DB)

		dbp.SQLMock.ExpectPing().WillReturnError(errTest)
		err = b.Init(ctx)
		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})
}

func TestBackend_IsHealthy(t *testing.T) {
	t.Parallel()

	ctx := testutil.NewDefaultTestContext(t)
	dbp := test.NewDBProviderWithPing(t)
	b, err := NewBackend(BackendOptions{DBProvider: dbp})
	require.NoError(t, err)
	require.NotNil(t, dbp.DB)

	dbp.SQLMock.ExpectPing().WillReturnError(nil)
	err = b.Init(ctx)
	require.NoError(t, err)

	dbp.SQLMock.ExpectPing().WillReturnError(nil)
	res, err := b.IsHealthy(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, res)

	dbp.SQLMock.ExpectPing().WillReturnError(errTest)
	res, err = b.IsHealthy(ctx, nil)
	require.Nil(t, res)
	require.Error(t, err)
	require.ErrorIs(t, err, errTest)
}

// expectSuccessfulResourceVersionAtomicInc sets up expectations for calling
// resourceVersionAtomicInc, where the returned RV will be 1.
func expectSuccessfulResourceVersionAtomicInc(t *testing.T, b testBackend) {
	b.QueryWithResult("select resource_version for update", 0, nil)
	b.ExecWithResult("insert resource_version")
}

// expectUnsuccessfulResourceVersionAtomicInc sets up expectations for calling
// resourceVersionAtomicInc, where the returned RV will be 1.
func expectUnsuccessfulResourceVersionAtomicInc(t *testing.T, b testBackend, err error) {
	b.QueryWithErr("select resource_version for update", errTest)
}

func TestResourceVersionAtomicInc(t *testing.T) {
	t.Parallel()

	dialect := sqltemplate.MySQL

	t.Run("happy path - insert new row", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1

		v, err := resourceVersionAtomicInc(ctx, b.DB, dialect, resKey)
		require.NoError(t, err)
		require.Equal(t, int64(1), v)
	})

	t.Run("happy path - update existing row", func(t *testing.T) {
		t.Parallel()

		b, ctx := setupBackendTest(t)

		b.QueryWithResult("select resource_version for update", 1, Rows{{2}})
		b.ExecWithResult("update resource_version")

		v, err := resourceVersionAtomicInc(ctx, b.DB, dialect, resKey)
		require.NoError(t, err)
		require.Equal(t, int64(3), v)
	})

	t.Run("error getting current version", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.QueryWithErr("select resource_version for update", errTest)

		v, err := resourceVersionAtomicInc(ctx, b.DB, dialect, resKey)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "get current resource version")
	})

	t.Run("error inserting new row", func(t *testing.T) {
		t.Parallel()

		b, ctx := setupBackendTest(t)

		b.QueryWithResult("select resource_version for update", 0, nil)
		b.ExecWithErr("insert resource_version", errTest)

		v, err := resourceVersionAtomicInc(ctx, b.DB, dialect, resKey)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource_version")
	})

	t.Run("error updating existing row", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.QueryWithResult("select resource_version for update", 1, Rows{{2}})
		b.ExecWithErr("update resource_version", errTest)

		v, err := resourceVersionAtomicInc(ctx, b.DB, dialect, resKey)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "increase resource version")
	})
}

func TestBackend_create(t *testing.T) {
	t.Parallel()
	event := resource.WriteEvent{
		Type: resource.WatchEvent_ADDED,
		Key:  resKey,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithResult("update resource_history")
		b.ExecWithResult("update resource")
		b.SQLMock.ExpectCommit()

		v, err := b.create(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(1), v)
	})

	t.Run("error inserting into resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("insert resource", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource:")
	})

	t.Run("error inserting into resource_history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource")
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history:")
	})

	t.Run("error incrementing resource version", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource")
		b.ExecWithResult("insert resource_history")
		expectUnsuccessfulResourceVersionAtomicInc(t, b, errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "increment resource version")
	})

	t.Run("error updating resource_history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b)
		b.ExecWithErr("update resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update resource_history")
	})

	t.Run("error updating resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b)
		b.ExecWithResult("update resource_history")
		b.ExecWithErr("update resource", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update resource rv")
	})
}

func TestBackend_update(t *testing.T) {
	t.Parallel()
	event := resource.WriteEvent{
		Type: resource.WatchEvent_MODIFIED,
		Key:  resKey,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithResult("update resource_history")
		b.ExecWithResult("update resource")
		b.SQLMock.ExpectCommit()

		v, err := b.update(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(1), v)
	})

	t.Run("error in first update to resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("update resource", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "initial resource update")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource")
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})

	t.Run("error incrementing rv", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource")
		b.ExecWithResult("insert resource_history")
		expectUnsuccessfulResourceVersionAtomicInc(t, b, errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "increment resource version")
	})

	t.Run("error updating history rv", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithErr("update resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update history rv")
	})

	t.Run("error updating resource rv", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithResult("update resource_history")
		b.ExecWithErr("update resource", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update resource rv")
	})
}

func TestBackend_delete(t *testing.T) {
	t.Parallel()
	event := resource.WriteEvent{
		Type: resource.WatchEvent_DELETED,
		Key:  resKey,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("delete resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithResult("update resource_history")
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(1), v)
	})

	t.Run("error deleting resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("delete resource", errTest)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "delete resource")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("delete resource")
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})

	t.Run("error incrementing resource version", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("delete resource")
		b.ExecWithResult("insert resource_history")
		expectUnsuccessfulResourceVersionAtomicInc(t, b, errTest)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "increment resource version")
	})

	t.Run("error updating resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("delete resource")
		b.ExecWithResult("insert resource_history")
		expectSuccessfulResourceVersionAtomicInc(t, b) // returns RV=1
		b.ExecWithErr("update resource_history", errTest)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update history rv")
	})
}
