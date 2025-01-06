package sql

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/tests/testsuite"
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

func TestMain(m *testing.M) {
	testsuite.Run(m)
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
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithResult("insert resource_history", 0, 1)
		b.SQLMock.ExpectCommit()

		err := b.create(ctx, event, 1234)
		require.NoError(t, err)
	})

	t.Run("error inserting into resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("insert resource", errTest)
		b.SQLMock.ExpectRollback()

		err := b.create(ctx, event, 1234)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource:")
	})

	t.Run("error inserting into resource_history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		err := b.create(ctx, event, 1234)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource history:")
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
		b.ExecWithResult("update resource", 0, 1)
		b.ExecWithResult("insert resource_history", 0, 1)
		b.SQLMock.ExpectCommit()

		err := b.update(ctx, event, 1234)
		require.NoError(t, err)
	})

	t.Run("error in first update to resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("update resource", errTest)
		b.SQLMock.ExpectRollback()

		err := b.update(ctx, event, 1234)
		require.Error(t, err)
		require.ErrorContains(t, err, "initial resource update")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("update resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		err := b.update(ctx, event, 1234)
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
		b.ExecWithResult("delete resource", 0, 1)
		b.ExecWithResult("insert resource_history", 0, 1)
		b.SQLMock.ExpectCommit()

		err := b.delete(ctx, event, 1234)
		require.NoError(t, err)
	})

	t.Run("error deleting resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("delete resource", errTest)
		b.SQLMock.ExpectCommit()

		err := b.delete(ctx, event, 1234)
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

		err := b.delete(ctx, event, 1234)
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
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithResult("insert resource_history", 0, 1)
		b.ExecWithResult("update resource_history", 0, 1)
		b.SQLMock.ExpectCommit()

		err := b.restore(ctx, event, 1234)
		require.NoError(t, err)
	})

	t.Run("error restoring resource", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithErr("insert resource", errTest)
		b.SQLMock.ExpectRollback()

		err := b.restore(ctx, event, 1234)
		require.Error(t, err)
		require.ErrorContains(t, err, "insert into resource:")
	})

	t.Run("error inserting into resource history", func(t *testing.T) {
		t.Parallel()
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.ExecWithResult("insert resource", 0, 1)
		b.ExecWithErr("insert resource_history", errTest)
		b.SQLMock.ExpectRollback()

		err := b.restore(ctx, event, 1234)
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

		err := b.restore(ctx, event, 1234)
		require.Error(t, err)
		require.ErrorContains(t, err, "update history uid")
	})
}

func testServer(t *testing.T) *backend {
	dbstore := infraDB.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)
	back, err := NewBackend(BackendOptions{
		DBProvider:      eDB,
		PollingInterval: 3 * time.Millisecond,
	})
	b := back.(*backend)
	require.NoError(t, err)
	require.NotNil(t, b)

	err = b.Init(context.TODO())
	require.NoError(t, err)
	return b
}
func TestIntegrationConcurrent(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	b := testServer(t)
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	stream, err := b.WatchWriteEvents(context.Background())
	require.NoError(t, err)

	var wg sync.WaitGroup
	wg.Add(10)
	for i := 0; i < 10; i++ {
		go func(start int) {
			defer wg.Done()
			for j := start; j < start+10; j++ {
				_, err := writeEvent(ctx, b, fmt.Sprintf("item%d", j), resource.WatchEvent_ADDED)
				require.NoError(t, err)
			}
		}(i * 10)
	}
	wg.Wait()
	require.NoError(t, err)

	// Check that events are strictly ordered by resource version
	var lastRV int64
	for i := 0; i < 100; i++ {
		select {
		case event := <-stream:
			// t.Log(event.ResourceVersion, event.Key.Name)
			require.GreaterOrEqual(t, event.ResourceVersion, lastRV)
			lastRV = event.ResourceVersion
		case <-ctx.Done():
			t.Fatal("context done before receiving all events")
		}
	}
}

func TestIntegrationListAfterWrite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	b := testServer(t)
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	for i := 0; i < 10; i++ {
		_, err := writeEvent(ctx, b, fmt.Sprintf("item%d", i), resource.WatchEvent_ADDED)
		require.NoError(t, err)

		lo := &resource.ListRequest{Options: &resource.ListOptions{Key: &resource.ResourceKey{Resource: "resource", Group: "group"}}}
		items := make([]string, 0)
		cb := func(iter resource.ListIterator) error {
			for iter.Next() {
				items = append(items, iter.Name())
			}
			return nil
		}
		_, err = b.ListIterator(ctx, lo, cb)
		require.NoError(t, err)
		require.Equal(t, i+1, len(items))
	}
}

func TestIntegrationSQLBackend(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	b := testServer(t)
	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	stream, err := b.WatchWriteEvents(context.Background())

	require.NoError(t, err)
	rv1, err := writeEvent(ctx, b, "item1", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv1, int64(0))
	rv2, err := writeEvent(ctx, b, "item2", resource.WatchEvent_ADDED)
	require.NoError(t, err)
	require.Greater(t, rv2, rv1)

	// Lock item 3. This should block the list and watch events.
	rv3, _ := b.lockKey(ctx, resourceKey("item3"))
	require.Greater(t, rv3, rv2)

	// Write more events while item 3 is locked.
	wg := sync.WaitGroup{}
	var rv4, rv5 int64
	wg.Add(2)
	go func() {
		rv4, err = writeEvent(ctx, b, "item4", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Greater(t, rv4, rv3)
		wg.Done()

		rv5, err = writeEvent(ctx, b, "item5", resource.WatchEvent_ADDED)
		require.NoError(t, err)
		require.Greater(t, rv5, rv4)
		wg.Done()
	}()
	t.Log(rv1, rv2, rv3)

	// List events should return rv3 until we release the lock
	nbItems := 0
	cb := func(it resource.ListIterator) error {
		nbItems = 0
		for it.Next() {
			nbItems++
		}
		return nil
	}

	var retry int
	var head int64
	for retry < 3 {
		head, err = b.ListIterator(ctx, &resource.ListRequest{Options: &resource.ListOptions{Key: &resource.ResourceKey{Resource: "resource", Group: "group"}}}, cb)
		require.NoError(t, err)
		require.Equal(t, 2, nbItems)
		require.GreaterOrEqual(t, head, rv2)
		require.Less(t, head, rv3)
		retry++
	}

	// listLatestRVs
	grv, err := b.listLatestRVs(ctx)
	require.NoError(t, err)
	require.Equal(t, groupResourceRV{"group": {"resource": rv3 - 1}}, grv)

	// Should have 2 events in the stream
	ev1 := <-stream
	require.Equal(t, "item1 ADDED", string(ev1.Value))
	ev2 := <-stream
	require.Equal(t, "item2 ADDED", string(ev2.Value))
	require.Equal(t, 0, len(stream))

	// Unlock item 3. This should unblock the list and watch events.
	b.unlockKey(resourceKey("item3"))
	wg.Wait()

	t.Log(rv4, rv5)

	head, err = b.ListIterator(ctx, &resource.ListRequest{Options: &resource.ListOptions{Key: &resource.ResourceKey{Resource: "resource", Group: "group"}}}, cb)
	require.NoError(t, err)
	require.Equal(t, rv5, head)

	// Should have 2 more events in the stream
	ev3 := <-stream
	require.Equal(t, "item4 ADDED", string(ev3.Value))
	ev4 := <-stream
	require.Equal(t, "item5 ADDED", string(ev4.Value))
}

func writeEvent(ctx context.Context, store Backend, name string, action resource.WatchEvent_Type) (int64, error) {
	res := &unstructured.Unstructured{
		Object: map[string]any{},
	}
	meta, err := utils.MetaAccessor(res)
	if err != nil {
		return 0, err
	}
	meta.SetFolder("folderuid")
	return store.WriteEvent(ctx, resource.WriteEvent{
		Type:   action,
		Value:  []byte(name + " " + resource.WatchEvent_Type_name[int32(action)]),
		Key:    resourceKey(name),
		Object: meta,
	})
}

func resourceKey(name string) *resource.ResourceKey {
	return &resource.ResourceKey{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Name:      name,
	}
}
