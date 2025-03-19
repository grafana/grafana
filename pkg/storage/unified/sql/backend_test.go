package sql

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
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

func TestBackend_restore(t *testing.T) {
	t.Parallel()
	meta, err := utils.MetaAccessor(&unstructured.Unstructured{
		Object: map[string]any{},
	})
	require.NoError(t, err)
	meta.SetUID("new-uid")
	oldMeta, err := utils.MetaAccessor(&unstructured.Unstructured{
		Object: map[string]any{},
	})
	require.NoError(t, err)
	oldMeta.SetUID("old-uid")
	event := resource.WriteEvent{
		Type:      resource.WatchEvent_ADDED,
		Key:       resKey,
		Object:    meta,
		ObjectOld: oldMeta,
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, b.TestDBProvider,
			func() { b.ExecWithResult("insert resource", 0, 1) },
			func() { b.ExecWithResult("insert resource_history", 0, 1) },
			func() { b.ExecWithResult("update resource_history", 0, 1) },
		)
		b.SQLMock.ExpectCommit()

		v, err := b.restore(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)
	})

	t.Run("error restoring resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("insert resource", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.restore(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.restore(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history")
	})

	t.Run("error updating resource history uid", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithResult("insert resource_history", 0, 1)
		b.ExecWithErr("update resource_history", errTest)
		b.SQLMock.ExpectRollback()

		v, err := b.restore(ctx, event)
		require.Zero(t, v)
		require.Error(t, err)
		require.ErrorContains(t, err, "update history uid")
	})
}

func TestBackend_getHistory(t *testing.T) {
	t.Parallel()

	// Common setup
	key := &resource.ResourceKey{
		Namespace: "ns",
		Group:     "gr",
		Resource:  "rs",
		Name:      "nm",
	}
	rv1, rv2, rv3 := int64(100), int64(200), int64(300)
	cols := []string{"resource_version", "namespace", "name", "folder", "value"}

	tests := []struct {
		name              string
		versionMatch      resource.ResourceVersionMatch
		resourceVersion   int64
		expectedVersions  []int64
		expectedListRv    int64
		expectedRowsCount int
		expectedErr       string
	}{
		{
			name:              "with ResourceVersionMatch_NotOlderThan",
			versionMatch:      resource.ResourceVersionMatch_NotOlderThan,
			resourceVersion:   rv2,
			expectedVersions:  []int64{rv3, rv2},
			expectedListRv:    rv3,
			expectedRowsCount: 2,
		},
		{
			name:              "with ResourceVersionMatch_Exact",
			versionMatch:      resource.ResourceVersionMatch_Exact,
			resourceVersion:   rv2,
			expectedVersions:  []int64{rv2},
			expectedListRv:    rv3,
			expectedRowsCount: 1,
		},
		{
			name:              "without version matcher",
			versionMatch:      resource.ResourceVersionMatch_NotOlderThan,
			expectedVersions:  []int64{rv3, rv2, rv1},
			expectedListRv:    rv3,
			expectedRowsCount: 3,
		},
		{
			name:            "error with ResourceVersionMatch_Exact and ResourceVersion <= 0",
			versionMatch:    resource.ResourceVersionMatch_Exact,
			resourceVersion: 0,
			expectedErr:     "expecting an explicit resource version query when using Exact matching",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			b, ctx := setupBackendTest(t)

			// Build request with appropriate matcher
			req := &resource.ListRequest{
				Options:         &resource.ListOptions{Key: key},
				ResourceVersion: tc.resourceVersion,
				VersionMatch:    tc.versionMatch,
				Source:          resource.ListRequest_HISTORY,
			}

			// Set up mock expectations only if we don't expect an error
			if tc.expectedErr == "" {
				// Build expected values map
				expectedValues := make(map[int64]string)
				for _, rv := range tc.expectedVersions {
					expectedValues[rv] = fmt.Sprintf("rv-%d", rv)
				}

				// Callback that tracks returned items
				callback := func(iter resource.ListIterator) error {
					count := 0
					for iter.Next() {
						count++
						currentRV := iter.ResourceVersion()
						expectedValue, ok := expectedValues[currentRV]
						require.True(t, ok, "Got unexpected RV: %d", currentRV)
						require.Equal(t, expectedValue, string(iter.Value()))
					}
					require.Equal(t, tc.expectedRowsCount, count)
					return nil
				}

				b.SQLMock.ExpectBegin()

				// Expect fetch latest RV call
				latestRVRows := sqlmock.NewRows([]string{"resource_version", "unix_timestamp"}).
					AddRow(rv3, 0)
				b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").WillReturnRows(latestRVRows)

				// Expect history query
				historyRows := sqlmock.NewRows(cols)
				for _, rv := range tc.expectedVersions {
					historyRows.AddRow(
						rv,                               // resource_version
						"ns",                             // namespace
						"nm",                             // name
						"folder",                         // folder
						[]byte(fmt.Sprintf("rv-%d", rv)), // value
					)
				}
				b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
				b.SQLMock.ExpectCommit()

				// Execute the test
				listRv, err := b.getHistory(ctx, req, callback)
				require.NoError(t, err)
				require.Equal(t, tc.expectedListRv, listRv)
			} else {
				// For error cases, we use a simple empty callback
				callback := func(iter resource.ListIterator) error { return nil }

				// Execute the test expecting an error
				listRv, err := b.getHistory(ctx, req, callback)
				require.Zero(t, listRv)
				require.Error(t, err)
				require.ErrorContains(t, err, tc.expectedErr)
			}
		})
	}
}
