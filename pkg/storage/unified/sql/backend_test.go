package sql

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/mattn/go-sqlite3"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	unifiedbackend "github.com/grafana/grafana/pkg/storage/unified/backend"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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

func (b testBackend) ExecWithResult(expectedSQL string, lastInsertID int64, rowsAffected int64) {
	b.SQLMock.ExpectExec(expectedSQL).WillReturnResult(sqlmock.NewResult(lastInsertID, rowsAffected))
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

func TestBackend_create(t *testing.T) {
	t.Parallel()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{
		Object: map[string]any{},
	})
	require.NoError(t, err)
	event := resource.WriteEvent{
		Type:   resource.WatchEvent_ADDED,
		Key:    resKey,
		Object: meta,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)
		b.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, b.TestDBProvider,
			func() { b.ExecWithResult("insert resource", 0, 1) },
			func() { b.ExecWithResult("insert resource_history", 0, 1) },
		)
		b.SQLMock.ExpectCommit()
		v, err := b.create(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)
	})

	t.Run("resource already exists", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)
		b.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, b.TestDBProvider,
			func() { b.ExecWithResult("insert resource", 0, 1) },
			func() { b.ExecWithResult("insert resource_history", 0, 1) },
		)
		b.SQLMock.ExpectCommit()
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectExec("insert resource").WillReturnError(sqlite3.Error{Code: sqlite3.ErrConstraint, ExtendedCode: sqlite3.ErrConstraintUnique})
		b.SQLMock.ExpectRollback()

		// First we insert the resource successfully. This is what the happy path test does as well.
		v, err := b.create(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)

		// Then we try to insert the same resource again. This should fail.
		_, err = b.create(ctx, event)
		require.ErrorIs(t, err, unifiedbackend.ErrResourceAlreadyExists)
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
		require.ErrorContains(t, err, "insert into resource")
	})

	t.Run("error inserting into resource_history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.create(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})
}

func TestBackend_update(t *testing.T) {
	t.Parallel()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{
		Object: map[string]any{},
	})
	require.NoError(t, err)
	meta.SetFolder("folderuid")
	event := resource.WriteEvent{
		Type:   resource.WatchEvent_MODIFIED,
		Key:    resKey,
		Object: meta,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, b.TestDBProvider,
			func() { b.ExecWithResult("update resource", 0, 1) },
			func() { b.ExecWithResult("insert resource_history", 0, 1) },
		)
		b.SQLMock.ExpectCommit()

		v, err := b.update(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)
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
		require.ErrorContains(t, err, "resource update")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.update(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})
}

func TestBackend_delete(t *testing.T) {
	t.Parallel()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{
		Object: map[string]any{},
	})
	require.NoError(t, err)
	event := resource.WriteEvent{
		Type:   resource.WatchEvent_DELETED,
		Key:    resKey,
		Object: meta,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, b.TestDBProvider,
			func() { b.ExecWithResult("delete resource", 0, 1) },
			func() { b.ExecWithResult("insert resource_history", 0, 1) },
		)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)
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
		b.ExecWithResult("delete resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectCommit()

		v, err := b.delete(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})
}

func getCallback(t *testing.T, expectedValues []getHistoryRow) func(iter resource.ListIterator) error {
	t.Helper()

	return func(iter resource.ListIterator) error {
		count := 0
		for iter.Next() {
			require.Equal(t, expectedValues[count].resourceVersion, iter.ResourceVersion())
			require.Equal(t, expectedValues[count].namespace, iter.Namespace())
			require.Equal(t, expectedValues[count].name, iter.Name())
			require.Equal(t, expectedValues[count].folder, iter.Folder())
			require.Equal(t, expectedValues[count].value, string(iter.Value()))
			count++
		}
		return nil
	}
}

type getHistoryRow struct {
	resourceVersion int64
	namespace       string
	name            string
	folder          string
	value           string
}

type readHistoryRow struct {
	namespace        string
	group            string
	resource         string
	name             string
	folder           string
	resource_version string
	value            string
}

func TestBackend_ReadResource(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedReadRow := readHistoryRow{
			namespace:        "ns",
			group:            "gr",
			resource:         "rs",
			name:             "nm",
			folder:           "folder",
			resource_version: "300",
			value:            "rv-300",
		}
		readResource := []string{"namespace", "group", "resource", "name", "folder", "resource_version", "value"}
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource").
			WillReturnRows(sqlmock.NewRows(readResource).
				AddRow(
					expectedReadRow.namespace,
					expectedReadRow.group,
					expectedReadRow.resource,
					expectedReadRow.name,
					expectedReadRow.folder,
					expectedReadRow.resource_version,
					expectedReadRow.value,
				))
		b.SQLMock.ExpectCommit()

		req := &resource.ReadRequest{
			Key: resKey,
		}
		rps := b.ReadResource(ctx, req)
		require.NotNil(t, rps)
		require.Equal(t, int64(300), rps.ResourceVersion)
		require.Equal(t, "rv-300", string(rps.Value))
		require.Equal(t, "folder", rps.Folder)
	})

	t.Run("no resource found", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource").
			WillReturnRows(sqlmock.NewRows([]string{}))
		b.SQLMock.ExpectCommit()

		req := &resource.ReadRequest{
			Key: resKey,
		}
		res := b.ReadResource(ctx, req)
		require.NotNil(t, res.Error)
		require.Equal(t, res.Error.Code, int32(404))
	})

	t.Run("with resource version", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedReadRow := readHistoryRow{
			namespace:        "ns",
			group:            "gr",
			resource:         "rs",
			name:             "nm",
			folder:           "folder",
			resource_version: "300",
			value:            "rv-300",
		}

		readHistoryColumns := []string{"namespace", "group", "resource", "name", "folder", "resource_version", "value"}
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(readHistoryColumns).
				AddRow(
					expectedReadRow.namespace,
					expectedReadRow.group,
					expectedReadRow.resource,
					expectedReadRow.name,
					expectedReadRow.folder,
					expectedReadRow.resource_version,
					expectedReadRow.value,
				))
		b.SQLMock.ExpectCommit()

		req := &resource.ReadRequest{
			Key:             resKey,
			ResourceVersion: 300,
		}
		rps := b.ReadResource(ctx, req)
		require.NotNil(t, rps)
		require.Equal(t, int64(300), rps.ResourceVersion)
		require.Equal(t, "rv-300", string(rps.Value))
		require.Equal(t, "folder", rps.Folder)
	})

	t.Run("error reading resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
			WillReturnError(errTest)

		req := &resource.ReadRequest{
			Key: resKey,
		}
		rps := b.ReadResource(ctx, req)
		require.NotNil(t, rps.Error)
	})
}

func TestBackend_getHistory(t *testing.T) {
	t.Parallel()

	key := &resource.ResourceKey{
		Namespace: "ns",
		Group:     "gr",
		Resource:  "rs",
		Name:      "nm",
	}
	rv1, rv2, rv3 := int64(100), int64(200), int64(300)
	getHistoryColumns := []string{"resource_version", "namespace", "name", "folder", "value"}
	readHistoryColumns := []string{"namespace", "group", "resource", "name", "folder", "resource_version", "value"}
	getResourceVersionColumns := []string{"resource_version", "unix_timestamp"}

	t.Run("with ResourceVersionMatchV2_NotOlderThan", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedResults := []getHistoryRow{
			{resourceVersion: rv3, namespace: "ns", name: "nm", folder: "folder", value: "rv-300"},
			{resourceVersion: rv2, namespace: "ns", name: "nm", folder: "folder", value: "rv-200"},
		}
		expectedListRv := rv3
		req := &resource.ListRequest{
			Options:         &resource.ListOptions{Key: key},
			ResourceVersion: rv2,
			VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
			Source:          resource.ListRequest_HISTORY,
		}

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").
			WillReturnRows(sqlmock.NewRows(getResourceVersionColumns).
				AddRow(expectedListRv, 0))
		historyRows := sqlmock.NewRows(getHistoryColumns)
		for _, result := range expectedResults {
			historyRows.AddRow(
				result.resourceVersion,
				result.namespace,
				result.name,
				result.folder,
				result.value,
			)
		}
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
		b.SQLMock.ExpectCommit()

		callback := getCallback(t, expectedResults)
		listRv, err := b.getHistory(ctx, req, callback)
		require.NoError(t, err)
		require.Equal(t, expectedListRv, listRv)
	})

	t.Run("with ResourceVersionMatchV2_Exact", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedResults := []getHistoryRow{
			{resourceVersion: rv2, namespace: "ns", name: "nm", folder: "folder", value: "rv-200"},
		}
		expectedListRv := rv3
		req := &resource.ListRequest{
			Options:         &resource.ListOptions{Key: key},
			ResourceVersion: rv2,
			VersionMatchV2:  resource.ResourceVersionMatchV2_NotOlderThan,
			Source:          resource.ListRequest_HISTORY,
		}

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").
			WillReturnRows(sqlmock.NewRows(getResourceVersionColumns).
				AddRow(expectedListRv, 0))
		historyRows := sqlmock.NewRows(getHistoryColumns)
		for _, result := range expectedResults {
			historyRows.AddRow(
				result.resourceVersion,
				result.namespace,
				result.name,
				result.folder,
				result.value,
			)
		}
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
		b.SQLMock.ExpectCommit()

		callback := getCallback(t, expectedResults)
		listRv, err := b.getHistory(ctx, req, callback)
		require.NoError(t, err)
		require.Equal(t, expectedListRv, listRv)
	})

	t.Run("with ListRequest_TRASH", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedResults := []getHistoryRow{
			{resourceVersion: rv3, namespace: "ns", name: "nm", folder: "folder", value: "rv-300"},
			{resourceVersion: rv2, namespace: "ns", name: "nm", folder: "folder", value: "rv-200"},
			{resourceVersion: rv1, namespace: "ns", name: "nm", folder: "folder", value: "rv-100"},
		}
		expectedListRv := rv3
		req := &resource.ListRequest{
			Options: &resource.ListOptions{Key: key},
			Source:  resource.ListRequest_TRASH,
		}

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").
			WillReturnRows(sqlmock.NewRows(getResourceVersionColumns).
				AddRow(expectedListRv, 0))
		historyRows := sqlmock.NewRows(getHistoryColumns)
		for _, result := range expectedResults {
			historyRows.AddRow(
				result.resourceVersion,
				result.namespace,
				result.name,
				result.folder,
				result.value,
			)
		}
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
		b.SQLMock.ExpectCommit()

		callback := getCallback(t, expectedResults)
		listRv, err := b.getHistory(ctx, req, callback)
		require.NoError(t, err)
		require.Equal(t, expectedListRv, listRv)
	})

	t.Run("with no version matcher", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedResults := []getHistoryRow{
			{resourceVersion: rv3, namespace: "ns", name: "nm", folder: "folder", value: "rv-300"},
			{resourceVersion: rv2, namespace: "ns", name: "nm", folder: "folder", value: "rv-200"},
			{resourceVersion: rv1, namespace: "ns", name: "nm", folder: "folder", value: "rv-100"},
		}
		expectedReadRow := readHistoryRow{
			namespace:        "ns",
			group:            "gr",
			resource:         "rs",
			name:             "nm",
			folder:           "folder",
			resource_version: "300",
			value:            "rv-300",
		}
		expectedListRv := rv3
		req := &resource.ListRequest{
			Options:        &resource.ListOptions{Key: key},
			VersionMatchV2: resource.ResourceVersionMatchV2_NotOlderThan,
			Source:         resource.ListRequest_HISTORY,
		}

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(readHistoryColumns).
				AddRow(
					expectedReadRow.namespace,
					expectedReadRow.group,
					expectedReadRow.resource,
					expectedReadRow.name,
					expectedReadRow.folder,
					expectedReadRow.resource_version,
					expectedReadRow.value,
				))
		b.SQLMock.ExpectCommit()
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").
			WillReturnRows(sqlmock.NewRows(getResourceVersionColumns).
				AddRow(expectedListRv, 0))

		historyRows := sqlmock.NewRows(getHistoryColumns)
		for _, result := range expectedResults {
			historyRows.AddRow(
				result.resourceVersion,
				result.namespace,
				result.name,
				result.folder,
				result.value,
			)
		}
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
		b.SQLMock.ExpectCommit()

		callback := getCallback(t, expectedResults)
		listRv, err := b.getHistory(ctx, req, callback)
		require.NoError(t, err)
		require.Equal(t, expectedListRv, listRv)
	})

	t.Run("error with ResourceVersionMatch_Exact and ResourceVersion <= 0", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		expectedErr := "expecting an explicit resource version query when using Exact matching"
		req := &resource.ListRequest{
			Options:        &resource.ListOptions{Key: key},
			VersionMatchV2: resource.ResourceVersionMatchV2_Exact,
			Source:         resource.ListRequest_HISTORY,
		}

		callback := func(iter resource.ListIterator) error { return nil }
		listRv, err := b.getHistory(ctx, req, callback)
		require.Zero(t, listRv)
		require.Error(t, err)
		require.ErrorContains(t, err, expectedErr)
	})
}
