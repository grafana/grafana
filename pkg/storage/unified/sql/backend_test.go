package sql

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/mattn/go-sqlite3"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var (
	errTest = errors.New("things happened")
	resKey  = &resourcepb.ResourceKey{
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
		Type:   resourcepb.WatchEvent_ADDED,
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
		b.SQLMock.ExpectExec("insert resource").WillReturnError(sqlite.TestErrUniqueConstraintViolation)
		b.SQLMock.ExpectRollback()

		// First we insert the resource successfully. This is what the happy path test does as well.
		v, err := b.create(ctx, event)
		require.NoError(t, err)
		require.Equal(t, int64(200), v)

		// Then we try to insert the same resource again. This should fail.
		_, err = b.create(ctx, event)
		require.ErrorIs(t, err, resource.ErrResourceAlreadyExists)
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
		Type:   resourcepb.WatchEvent_MODIFIED,
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
		Type:   resourcepb.WatchEvent_DELETED,
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

type readHistoryRow struct {
	guid             string
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
			guid:             "guid",
			namespace:        "ns",
			group:            "gr",
			resource:         "rs",
			name:             "nm",
			folder:           "folder",
			resource_version: "300",
			value:            "rv-300",
		}
		readResource := []string{"guid", "namespace", "group", "resource", "name", "folder", "resource_version", "value"}
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource").
			WillReturnRows(sqlmock.NewRows(readResource).
				AddRow(
					expectedReadRow.guid,
					expectedReadRow.namespace,
					expectedReadRow.group,
					expectedReadRow.resource,
					expectedReadRow.name,
					expectedReadRow.folder,
					expectedReadRow.resource_version,
					expectedReadRow.value,
				))
		b.SQLMock.ExpectCommit()

		req := &resourcepb.ReadRequest{
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

		req := &resourcepb.ReadRequest{
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
			guid:             "guid",
			namespace:        "ns",
			group:            "gr",
			resource:         "rs",
			name:             "nm",
			folder:           "folder",
			resource_version: "300",
			value:            "rv-300",
		}

		readHistoryColumns := []string{"guid", "namespace", "group", "resource", "name", "folder", "resource_version", "value"}
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(readHistoryColumns).
				AddRow(
					expectedReadRow.guid,
					expectedReadRow.namespace,
					expectedReadRow.group,
					expectedReadRow.resource,
					expectedReadRow.name,
					expectedReadRow.folder,
					expectedReadRow.resource_version,
					expectedReadRow.value,
				))
		b.SQLMock.ExpectCommit()

		req := &resourcepb.ReadRequest{
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

		req := &resourcepb.ReadRequest{
			Key: resKey,
		}
		rps := b.ReadResource(ctx, req)
		require.NotNil(t, rps.Error)
	})
}

func TestBackend_getHistory(t *testing.T) {
	t.Parallel()

	// Common setup
	key := &resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "gr",
		Resource:  "rs",
		Name:      "nm",
	}
	rv1, rv2, rv3 := int64(100), int64(200), int64(300)
	cols := []string{"guid", "resource_version", "namespace", "group", "resource", "name", "folder", "value"}

	tests := []struct {
		name                          string
		source                        resourcepb.ListRequest_Source
		versionMatch                  resourcepb.ResourceVersionMatchV2
		resourceVersion               int64
		expectedVersions              []int64
		expectedListRv                int64
		expectedRowsCount             int
		expectedErr                   string
		expectedLatestDeletionAsMinRV bool
	}{
		{
			name:              "with ResourceVersionMatch_NotOlderThan",
			source:            resourcepb.ListRequest_HISTORY,
			versionMatch:      resourcepb.ResourceVersionMatchV2_NotOlderThan,
			resourceVersion:   rv2,
			expectedVersions:  []int64{rv2, rv3}, // Should be in ASC order due to NotOlderThan
			expectedListRv:    rv3,
			expectedRowsCount: 2,
		},
		{
			name:                          "with ResourceVersionMatch_NotOlderThan and ResourceVersion=0",
			source:                        resourcepb.ListRequest_HISTORY,
			versionMatch:                  resourcepb.ResourceVersionMatchV2_NotOlderThan,
			resourceVersion:               0,
			expectedVersions:              []int64{rv1, rv2, rv3}, // Should be in ASC order due to NotOlderThan
			expectedListRv:                rv3,
			expectedRowsCount:             3,
			expectedLatestDeletionAsMinRV: true,
		},
		{
			name:              "with ResourceVersionMatch_Exact",
			source:            resourcepb.ListRequest_HISTORY,
			versionMatch:      resourcepb.ResourceVersionMatchV2_Exact,
			resourceVersion:   rv2,
			expectedVersions:  []int64{rv2},
			expectedListRv:    rv3,
			expectedRowsCount: 1,
		},
		{
			name:                          "with ResourceVersionMatch_Unset (default)",
			source:                        resourcepb.ListRequest_HISTORY,
			expectedVersions:              []int64{rv3, rv2, rv1}, // Should be in DESC order by default
			expectedListRv:                rv3,
			expectedRowsCount:             3,
			expectedLatestDeletionAsMinRV: true,
		},
		{
			name:            "error with ResourceVersionMatch_Exact and ResourceVersion <= 0",
			source:          resourcepb.ListRequest_HISTORY,
			versionMatch:    resourcepb.ResourceVersionMatchV2_Exact,
			resourceVersion: 0,
			expectedErr:     "expecting an explicit resource version query when using Exact matching",
		},
		{
			name:              "with ListRequest_TRASH",
			source:            resourcepb.ListRequest_TRASH,
			expectedVersions:  []int64{rv3, rv2, rv1}, // Should be in DESC order by default
			expectedListRv:    rv3,
			expectedRowsCount: 3,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			b, ctx := setupBackendTest(t)

			// Build request with appropriate matcher
			req := &resourcepb.ListRequest{
				Options:         &resourcepb.ListOptions{Key: key},
				ResourceVersion: tc.resourceVersion,
				VersionMatchV2:  tc.versionMatch,
				Source:          tc.source,
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
					var seenVersions []int64
					for iter.Next() {
						count++
						currentRV := iter.ResourceVersion()
						seenVersions = append(seenVersions, currentRV)
						expectedValue, ok := expectedValues[currentRV]
						require.True(t, ok, "Got unexpected RV: %d", currentRV)
						require.Equal(t, expectedValue, string(iter.Value()))
					}
					require.Equal(t, tc.expectedRowsCount, count)
					// Verify the order matches what we expect
					require.Equal(t, tc.expectedVersions, seenVersions, "Resource versions returned in incorrect order")
					return nil
				}

				b.SQLMock.ExpectBegin()

				// Expect fetch latest RV call
				latestRVRows := sqlmock.NewRows([]string{"resource_version", "unix_timestamp"}).
					AddRow(rv3, 0)
				b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").WillReturnRows(latestRVRows)

				if tc.expectedLatestDeletionAsMinRV {
					latestHistoryRVRows := sqlmock.NewRows([]string{"resource_version"}).
						AddRow(rv1)
					b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
						WillReturnRows(latestHistoryRVRows)
				}

				// Expect history query
				historyRows := sqlmock.NewRows(cols)
				for _, rv := range tc.expectedVersions {
					historyRows.AddRow(
						"guid",                           // guid
						rv,                               // resource_version
						"ns",                             // namespace
						"gr",                             // group
						"rs",                             // resource
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

// TestBackend_getHistoryPagination tests the ordering behavior for ResourceVersionMatch_NotOlderThan
// when using pagination, ensuring entries are returned in oldest-to-newest order.
func TestBackend_getHistoryPagination(t *testing.T) {
	t.Parallel()

	// Common setup
	key := &resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "gr",
		Resource:  "rs",
		Name:      "nm",
	}

	// Create resource versions that will be returned in our test
	versions := make([]int64, 10)
	for i := range versions {
		versions[i] = int64(51 + i)
	}
	rv51, rv52, rv53, rv54, rv55, rv56, rv57, rv58, rv59, rv60 := versions[0], versions[1], versions[2], versions[3], versions[4], versions[5], versions[6], versions[7], versions[8], versions[9]

	t.Run("pagination with NotOlderThan should return entries from oldest to newest", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		// Define all pages we want to test
		pages := []struct {
			versions []int64
			token    *resource.ContinueToken
		}{
			{
				versions: []int64{rv51, rv52, rv53, rv54},
				token:    nil,
			},
			{
				versions: []int64{rv55, rv56, rv57, rv58},
				token: &resource.ContinueToken{
					ResourceVersion: rv54,
					StartOffset:     4,
					SortAscending:   true,
				},
			},
			{
				versions: []int64{rv59, rv60},
				token: &resource.ContinueToken{
					ResourceVersion: rv58,
					StartOffset:     8,
					SortAscending:   true,
				},
			},
		}

		var allItems []int64
		initialRV := rv51

		// Test each page
		for _, page := range pages {
			req := &resourcepb.ListRequest{
				Options:         &resourcepb.ListOptions{Key: key},
				ResourceVersion: initialRV,
				VersionMatchV2:  resourcepb.ResourceVersionMatchV2_NotOlderThan,
				Source:          resourcepb.ListRequest_HISTORY,
				Limit:           4,
			}
			if page.token != nil {
				req.NextPageToken = page.token.String()
			}

			expectedLatestDeletionAsMinRV := false
			items := make([]int64, 0)
			callback := func(iter resource.ListIterator) error {
				for iter.Next() {
					items = append(items, iter.ResourceVersion())
				}
				return nil
			}

			b.SQLMock.ExpectBegin()
			historyRows := setupHistoryTest(b, page.versions, rv60, expectedLatestDeletionAsMinRV)
			b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
			b.SQLMock.ExpectCommit()

			listRv, err := b.getHistory(ctx, req, callback)
			require.NoError(t, err)
			require.Equal(t, rv60, listRv, "Head version should be the latest resource version (rv60)")
			require.Equal(t, page.versions, items, "Items should be in ASC order")

			allItems = append(allItems, items...)
		}

		// Verify complete sequence
		expectedAllItems := []int64{rv51, rv52, rv53, rv54, rv55, rv56, rv57, rv58, rv59, rv60}
		require.Equal(t, expectedAllItems, allItems)
	})

	t.Run("pagination with ResourceVersion=0 and NotOlderThan should return entries in ASC order", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		req := &resourcepb.ListRequest{
			Options:         &resourcepb.ListOptions{Key: key},
			ResourceVersion: 0,
			VersionMatchV2:  resourcepb.ResourceVersionMatchV2_NotOlderThan,
			Source:          resourcepb.ListRequest_HISTORY,
			Limit:           4,
		}

		expectedLatestDeletionAsMinRV := true
		// First batch of items we expect, in ASC order (because of NotOlderThan flag)
		// Even with ResourceVersion=0, the order is ASC because we use SortAscending=true
		expectedVersions := []int64{rv51, rv52, rv53, rv54}
		items := make([]int64, 0)

		callback := func(iter resource.ListIterator) error {
			for iter.Next() {
				items = append(items, iter.ResourceVersion())
			}
			return nil
		}

		b.SQLMock.ExpectBegin()
		historyRows := setupHistoryTest(b, expectedVersions, rv60, expectedLatestDeletionAsMinRV)
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").WillReturnRows(historyRows)
		b.SQLMock.ExpectCommit()

		listRv, err := b.getHistory(ctx, req, callback)
		require.NoError(t, err)
		require.Equal(t, rv60, listRv, "Head version should be the latest resource version (rv60)")
		require.Equal(t, expectedVersions, items, "Items should be in ASC order even with ResourceVersion=0")
	})
}

// setupHistoryTest creates the necessary mock expectations for a history test
func setupHistoryTest(b testBackend, resourceVersions []int64, latestRV int64, expectedLatestDeletionAsMinRV4 bool) *sqlmock.Rows {
	// Expect fetch latest RV call - set to the highest resource version
	latestRVRows := sqlmock.NewRows([]string{"resource_version", "unix_timestamp"}).
		AddRow(latestRV, 0)
	b.SQLMock.ExpectQuery("SELECT .* FROM resource_version").WillReturnRows(latestRVRows)

	if expectedLatestDeletionAsMinRV4 {
		latestHistoryRVRows := sqlmock.NewRows([]string{"resource_version"}).
			AddRow(latestRV)
		b.SQLMock.ExpectQuery("SELECT .* FROM resource_history").
			WillReturnRows(latestHistoryRVRows)
	}

	// Create the mock rows for the history items
	cols := []string{"guid", "resource_version", "namespace", "group", "resource", "name", "folder", "value"}
	historyRows := sqlmock.NewRows(cols)
	for _, rv := range resourceVersions {
		historyRows.AddRow(
			"guid",                           // guid
			rv,                               // resource_version
			"ns",                             // namespace
			"gr",                             // group
			"rs",                             // resource
			"nm",                             // name
			"folder",                         // folder
			[]byte(fmt.Sprintf("rv-%d", rv)), // value
		)
	}

	return historyRows
}
