package storewrapper

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
)

var allowAllWatchFilter WatchEventFilter = func(events []watch.Event) ([]bool, error) {
	allowed := make([]bool, len(events))
	for i := range allowed {
		allowed[i] = true
	}
	return allowed, nil
}

type testSetup struct {
	mockStore *rest.MockStorage
	mockAuth  *FakeAuthorizer
	wrapper   *Wrapper
	ctx       context.Context
}

func newTestSetup(t *testing.T) *testSetup {
	mockStore := rest.NewMockStorage(t)
	mockAuth := &FakeAuthorizer{}
	wrapper := New(mockStore, mockAuth)

	ctx := identity.WithRequester(
		context.Background(),
		&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
	)

	return &testSetup{mockStore: mockStore, mockAuth: mockAuth, wrapper: wrapper, ctx: ctx}
}

func newTestSetupWithPreserveIdentity(t *testing.T) *testSetup {
	mockStore := rest.NewMockStorage(t)
	mockAuth := &FakeAuthorizer{}
	wrapper := New(mockStore, mockAuth, WithPreserveIdentity())

	ctx := identity.WithRequester(
		context.Background(),
		&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
	)

	return &testSetup{mockStore: mockStore, mockAuth: mockAuth, wrapper: wrapper, ctx: ctx}
}

func matchesOriginalUser() func(context.Context) bool {
	return func(ctx context.Context) bool {
		user, err := identity.GetRequester(ctx)
		return err == nil && user.GetUID() == "user:u001"
	}
}

func matchesServiceIdentity() func(context.Context) bool {
	return func(ctx context.Context) bool {
		return identity.IsServiceIdentity(ctx)
	}
}

func TestWrapper_Create(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{}
		createOpts := &metaV1.CreateOptions{}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "created"}}

		// Verify original user identity is used for authorization
		setup.mockAuth.On("BeforeCreate", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("Create", mock.MatchedBy(matchesServiceIdentity()), obj, mock.Anything, createOpts).Return(expectedObj, nil)

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, createOpts)

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{}
		createOpts := &metaV1.CreateOptions{}

		// Simulate unauthorized error from authorizer
		setup.mockAuth.On("BeforeCreate", mock.MatchedBy(matchesOriginalUser()), obj).Return(ErrUnauthorized)

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, createOpts)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertNotCalled(t, "Create")
	})
}

func TestWrapper_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)
		version := "1"
		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		deleteOpts := &metaV1.DeleteOptions{Preconditions: &metaV1.Preconditions{ResourceVersion: &version}}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "deleted"}}

		// Mock Get to fetch the object before deletion
		setup.mockStore.On("Get", mock.MatchedBy(matchesServiceIdentity()), "to-delete", mock.Anything).Return(obj, nil)

		// Verify original user identity is used for authorization
		setup.mockAuth.On("BeforeDelete", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("Delete", mock.MatchedBy(matchesServiceIdentity()), "to-delete", mock.Anything, deleteOpts).Return(expectedObj, true, nil)

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, deleteOpts)

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)
		assert.True(t, deleted)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)
		version := "1"
		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		deleteOpts := &metaV1.DeleteOptions{Preconditions: &metaV1.Preconditions{ResourceVersion: &version}}

		// Mock Get to fetch the object before deletion
		setup.mockStore.On("Get", mock.MatchedBy(matchesServiceIdentity()), "to-delete", mock.Anything).Return(obj, nil)

		// Simulate unauthorized error from authorizer
		setup.mockAuth.On("BeforeDelete", mock.MatchedBy(matchesOriginalUser()), obj).Return(ErrUnauthorized)

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, deleteOpts)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.False(t, deleted)
		assert.Equal(t, ErrUnauthorized, err)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
		setup.mockStore.AssertNotCalled(t, "Delete")
	})
}

func TestWrapper_Get(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("Get", mock.MatchedBy(matchesServiceIdentity()), "fetched", mock.Anything).Return(obj, nil)

		// Verify original user identity is used for after-get authorization
		setup.mockAuth.On("AfterGet", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.NoError(t, err)
		assert.Equal(t, obj, result)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("Get", mock.MatchedBy(matchesServiceIdentity()), "fetched", mock.Anything).Return(obj, nil)

		// Simulate unauthorized error from after-get authorizer
		setup.mockAuth.On("AfterGet", mock.MatchedBy(matchesOriginalUser()), obj).Return(ErrUnauthorized)

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
}

func TestWrapper_List(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)

		listObj := &metaV1.List{Items: []runtime.RawExtension{
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item1"}}},
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item2"}}},
		}}

		filteredListObj := &metaV1.List{Items: []runtime.RawExtension{
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item1"}}},
		}}

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).Return(listObj, nil)

		// Verify original user identity is used for filtering the list
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), listObj).Return(filteredListObj, nil)

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.NoError(t, err)
		assert.Equal(t, filteredListObj, result)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		listObj := &metaV1.List{Items: []runtime.RawExtension{
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item1"}}},
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item2"}}},
		}}

		// Verify service identity is used to call the underlying store
		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).Return(listObj, nil)

		// Simulate unauthorized error from FilterList authorizer
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), listObj).Return(nil, ErrUnauthorized)

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)

		// Assert expectations
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
}

func TestWrapper_Update(t *testing.T) {
	setup := newTestSetup(t)

	oldObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{
		Name: "to-update", ResourceVersion: "2", Labels: map[string]string{"updated": "false"},
	}}
	objInfo := &fakeUpdatedObjectInfo{obj: oldObj}
	updateOpts := &metaV1.UpdateOptions{}

	var authzInfo *authorizedUpdateInfo

	// Verify service identity is used to call the underlying store
	setup.mockStore.On("Update",
		mock.MatchedBy(matchesServiceIdentity()),
		"to-update",
		mock.MatchedBy(func(info *authorizedUpdateInfo) bool {
			// Capture the authorizedUpdateInfo for later verification
			authzInfo = info
			return true
		}),
		mock.Anything,
		mock.Anything,
		false,
		updateOpts).Return(oldObj, true, nil)

	result, updated, err := setup.wrapper.Update(setup.ctx, "to-update", objInfo, nil, nil, false, updateOpts)
	require.NoError(t, err)
	assert.Equal(t, oldObj, result)
	assert.True(t, updated)

	// Now verify that the authorization is performed inside UpdatedObject
	setup.mockAuth.On("BeforeUpdate", mock.MatchedBy(matchesOriginalUser()), oldObj, oldObj).Return(nil)
	obj, err := authzInfo.UpdatedObject(context.Background(), oldObj)
	require.NoError(t, err)
	assert.Equal(t, oldObj, obj)

	// Assert expectations
	setup.mockAuth.AssertExpectations(t)
	setup.mockStore.AssertExpectations(t)
}

func TestWrapper_DeleteCollection(t *testing.T) {
	setup := newTestSetup(t)

	result, err := setup.wrapper.DeleteCollection(setup.ctx, nil, &metaV1.DeleteOptions{}, &internalversion.ListOptions{})

	require.Error(t, err)
	assert.True(t, k8serrors.IsMethodNotSupported(err), "expected MethodNotSupported error, got: %v", err)
	assert.Nil(t, result)
}

func TestWrapper_PassthroughMethods(t *testing.T) {
	setup := newTestSetup(t)

	t.Run("New", func(t *testing.T) {
		obj := &fakeObject{}
		setup.mockStore.On("New").Return(obj).Once()
		assert.Equal(t, obj, setup.wrapper.New())
	})

	t.Run("NewList", func(t *testing.T) {
		obj := &fakeObject{}
		setup.mockStore.On("NewList").Return(obj).Once()
		assert.Equal(t, obj, setup.wrapper.NewList())
	})

	t.Run("GetSingularName", func(t *testing.T) {
		setup.mockStore.On("GetSingularName").Return("fake").Once()
		assert.Equal(t, "fake", setup.wrapper.GetSingularName())
	})

	t.Run("NamespaceScoped", func(t *testing.T) {
		setup.mockStore.On("NamespaceScoped").Return(true).Once()
		assert.True(t, setup.wrapper.NamespaceScoped())
	})

	t.Run("Destroy", func(t *testing.T) {
		setup.mockStore.On("Destroy").Once()
		setup.wrapper.Destroy()
	})

	t.Run("ConvertToTable", func(t *testing.T) {
		obj := &fakeObject{}
		table := &metaV1.Table{}
		setup.mockStore.On("ConvertToTable", setup.ctx, obj, mock.Anything).Return(table, nil).Once()
		result, err := setup.wrapper.ConvertToTable(setup.ctx, obj, nil)
		require.NoError(t, err)
		assert.Equal(t, table, result)
	})

	setup.mockStore.AssertExpectations(t)
}

func TestWrapper_WithPreserveIdentity(t *testing.T) {
	t.Run("Create passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{}
		createOpts := &metaV1.CreateOptions{}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "created"}}

		setup.mockAuth.On("BeforeCreate", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)
		// Inner store must receive original user identity, not service identity.
		setup.mockStore.On("Create", mock.MatchedBy(matchesOriginalUser()), obj, mock.Anything, createOpts).Return(expectedObj, nil)

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, createOpts)

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})

	t.Run("Get passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}

		setup.mockStore.On("Get", mock.MatchedBy(matchesOriginalUser()), "fetched", mock.Anything).Return(obj, nil)
		setup.mockAuth.On("AfterGet", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.NoError(t, err)
		assert.Equal(t, obj, result)
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})

	t.Run("List passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		listObj := &metaV1.List{}

		setup.mockStore.On("List", mock.MatchedBy(matchesOriginalUser()), mock.Anything).Return(listObj, nil)
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), listObj).Return(listObj, nil)

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.NoError(t, err)
		assert.Equal(t, listObj, result)
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})

	t.Run("Delete passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		deleteOpts := &metaV1.DeleteOptions{}

		setup.mockStore.On("Get", mock.MatchedBy(matchesOriginalUser()), "to-delete", mock.Anything).Return(obj, nil)
		setup.mockAuth.On("BeforeDelete", mock.MatchedBy(matchesOriginalUser()), obj).Return(nil)
		setup.mockStore.On("Delete", mock.MatchedBy(matchesOriginalUser()), "to-delete", mock.Anything, deleteOpts).Return(obj, true, nil)

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, deleteOpts)

		require.NoError(t, err)
		assert.Equal(t, obj, result)
		assert.True(t, deleted)
		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
}

func TestWrapper_Watch(t *testing.T) {
	t.Run("returns error when inner store does not support Watch", func(t *testing.T) {
		setup := newTestSetup(t)
		// MockStorage does not implement k8srest.Watcher, so Watch should fail.
		setup.mockAuth.On("WatchFilter", mock.Anything).Return(PassThroughWatchFilter, nil)
		_, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.Error(t, err)
	})

	t.Run("filters out unauthorized events and forwards authorized ones", func(t *testing.T) {
		setup := newTestSetup(t)

		allowedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "allowed"}}
		deniedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "denied"}}

		allowedEvent := watch.Event{Type: watch.Added, Object: allowedObj}

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		// Filter: allow "allowed", deny "denied".
		filter := WatchEventFilter(func(events []watch.Event) ([]bool, error) {
			results := make([]bool, len(events))
			for i, e := range events {
				obj, ok := e.Object.(*fakeObject)
				results[i] = ok && obj.Name == "allowed"
			}
			return results, nil
		})
		setup.mockAuth.On("WatchFilter", mock.MatchedBy(matchesOriginalUser())).Return(filter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		fakeWatcher.Add(allowedObj)
		fakeWatcher.Add(deniedObj)

		event := <-w.ResultChan()
		assert.Equal(t, allowedEvent, event)

		// The denied event must not appear; close the inner watcher and drain
		// the result channel in extra to confirm no other events were forwarded.
		fakeWatcher.Stop()
		extra := make([]watch.Event, 0, len(w.ResultChan()))
		for e := range w.ResultChan() {
			extra = append(extra, e)
		}
		assert.Empty(t, extra, "no further events should have been forwarded")

		setup.mockAuth.AssertExpectations(t)
	})

	t.Run("nil filter (RejectAllWatchFilter) is fail-closed: Watch returns Unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		// RejectAllWatchFilter is the nil sentinel; the wrapper must refuse to start the watch.
		setup.mockAuth.On("WatchFilter", mock.Anything).Return(RejectAllWatchFilter, nil)

		_, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.Error(t, err)
		assert.True(t, k8serrors.IsUnauthorized(err), "expected Unauthorized, got %v", err)
	})

	t.Run("always forwards Bookmark events without filtering", func(t *testing.T) {
		setup := newTestSetup(t)

		bookmarkObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{ResourceVersion: "42"}}

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		// Non-nil filter that rejects every data event — Bookmark must still get through.
		denyAll := WatchEventFilter(func(events []watch.Event) ([]bool, error) {
			return make([]bool, len(events)), nil
		})
		setup.mockAuth.On("WatchFilter", mock.Anything).Return(denyAll, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		fakeWatcher.Action(watch.Bookmark, bookmarkObj)
		fakeWatcher.Stop()

		events := make([]watch.Event, 0, len(w.ResultChan()))
		for e := range w.ResultChan() {
			events = append(events, e)
		}

		require.Len(t, events, 1)
		assert.Equal(t, watch.Bookmark, events[0].Type)
	})

	t.Run("always forwards Error events without filtering", func(t *testing.T) {
		setup := newTestSetup(t)

		errObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "err"}}

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		denyAll := WatchEventFilter(func(events []watch.Event) ([]bool, error) {
			return make([]bool, len(events)), nil
		})
		setup.mockAuth.On("WatchFilter", mock.Anything).Return(denyAll, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		fakeWatcher.Action(watch.Error, errObj)
		fakeWatcher.Stop()

		events := make([]watch.Event, 0, len(w.ResultChan()))
		for e := range w.ResultChan() {
			events = append(events, e)
		}

		require.Len(t, events, 1)
		assert.Equal(t, watch.Error, events[0].Type)
	})

	t.Run("uses service identity for inner Watch call", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{
			K8sStorage: setup.mockStore,
			watcher:    fakeWatcher,
			assertCtx:  matchesServiceIdentity(),
		}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.MatchedBy(matchesOriginalUser())).Return(PassThroughWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		assert.True(t, watcherStore.ctxOk, "inner Watch should receive service identity context")
		w.Stop()
	})

	t.Run("WatchFilter error is returned from Watch", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(PassThroughWatchFilter, ErrUnauthorized)

		_, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.ErrorIs(t, err, ErrUnauthorized)
	})

	t.Run("PassThroughWatchFilter bypasses wrapping: returns inner watcher", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(PassThroughWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		// Pointer identity is the canonical bypass guarantee: the wrapper
		// returns the inner watch.Interface unchanged. This implies no
		// filteredWatcher goroutine was spawned and the filter is never invoked
		// (any later Stop() / event flow is inner's, not the wrapper's).
		require.Same(t, fakeWatcher, w, "PassThroughWatchFilter must return the inner watch.Interface unchanged")
	})

	t.Run("emits watch.Error event when filter returns an error and then closes", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item"}}

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		boom := errors.New("filter boom")
		filter := WatchEventFilter(func(events []watch.Event) ([]bool, error) {
			return nil, boom
		})
		setup.mockAuth.On("WatchFilter", mock.Anything).Return(filter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		fakeWatcher.Add(obj)

		// First event must be a watch.Error carrying the filter's error message.
		// Bound the receive so a regression hangs at most 1s instead of the suite timeout.
		var event watch.Event
		select {
		case e, open := <-w.ResultChan():
			require.True(t, open, "result channel closed before watch.Error event was forwarded")
			event = e
		case <-time.After(time.Second):
			t.Fatal("did not receive watch.Error event within timeout")
		}
		require.Equal(t, watch.Error, event.Type)
		status, ok := event.Object.(*metaV1.Status)
		require.True(t, ok, "expected Status object on watch.Error event, got %T", event.Object)
		assert.Equal(t, metaV1.StatusFailure, status.Status)
		assert.Contains(t, status.Message, boom.Error())

		// After the error, the result channel must close (run() returned)
		// and the inner watcher must have been stopped.
		select {
		case _, open := <-w.ResultChan():
			assert.False(t, open, "result channel should be closed after filter error")
		case <-time.After(time.Second):
			t.Fatal("result channel did not close after filter error")
		}
		assert.True(t, fakeWatcher.IsStopped(), "inner watcher should be stopped after filter error")
	})

	t.Run("Stop is idempotent and does not panic on repeated calls", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		require.NotPanics(t, func() {
			w.Stop()
			w.Stop()
			w.Stop()
		})
	})

	t.Run("each filtered watcher Stops its own inner (no shared sync.Once)", func(t *testing.T) {
		setup := newTestSetup(t)

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		// First watcher.
		fakeWatcher1 := watch.NewFake()
		setup.wrapper.inner = &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher1}
		w1, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		// Second watcher, distinct inner.
		fakeWatcher2 := watch.NewFake()
		setup.wrapper.inner = &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher2}
		w2, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		w1.Stop()
		assert.True(t, fakeWatcher1.IsStopped(), "first inner watcher should be stopped")

		assert.False(t, fakeWatcher2.IsStopped(), "stopping w1 must not affect w2")

		w2.Stop()
		assert.True(t, fakeWatcher2.IsStopped(),
			"second inner watcher should also be stopped (regression: package-level sync.Once)")
	})

	t.Run("cancelling the request context shuts the watcher down", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		ctx, cancel := context.WithCancel(setup.ctx)
		w, err := setup.wrapper.Watch(ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		cancel()

		// run() should observe ctx.Done() and exit, closing the result channel.
		select {
		case _, open := <-w.ResultChan():
			assert.False(t, open, "result channel should be closed after ctx cancel")
		case <-time.After(time.Second):
			t.Fatal("result channel did not close after ctx cancel")
		}
	})

	t.Run("blocked consumer plus Stop does not deadlock the goroutine", func(t *testing.T) {
		setup := newTestSetup(t)

		// watch.FakeWatcher's Add and Stop are not concurrency-safe, so use a
		// minimal custom watcher whose channel we own and close exactly once.
		inner := newPumpedWatcher(int(watch.DefaultChanSize) * 3)
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: inner}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		// Fill the inner channel buffer without ever reading from w.ResultChan().
		// The filteredWatcher's run goroutine will start to forward events, then
		// block on a send to its result channel once that buffer also fills up.
		for i := int32(0); i < watch.DefaultChanSize*2; i++ {
			inner.push(watch.Event{Type: watch.Added, Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item"}}})
		}

		// Stop must return promptly even though the goroutine is blocked on a
		// send to result and we never drained it.
		stopped := make(chan struct{})
		go func() {
			w.Stop()
			close(stopped)
		}()

		select {
		case <-stopped:
		case <-time.After(2 * time.Second):
			t.Fatal("Stop() blocked while a slow consumer was holding the result channel")
		}
	})

	t.Run("blocked consumer automatically shuts down the watch", func(t *testing.T) {
		setup := newTestSetup(t)

		defaultSendTimeout = 10 * time.Millisecond
		defer func() {
			defaultSendTimeout = 1 * time.Second
		}()

		// Inner watcher has enough room to buffer the events without blocking.
		inner := newPumpedWatcher(int(watch.DefaultChanSize) * 3)
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: inner}
		setup.wrapper.inner = watcherStore

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)

		// Fill the inner channel buffer without ever reading from w.ResultChan().
		// Wrapper watcher result channel will be blocked at DefaultChanSize.
		for i := int32(0); i < watch.DefaultChanSize*2; i++ {
			inner.push(watch.Event{Type: watch.Added, Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item"}}})
		}

		// Wait for the send timeout to trigger. Use a generous overall timeout
		// because the run goroutine must first process ~100 events through the
		// filter before the result channel fills and the send timeout fires.
		assert.Eventually(t, inner.IsStopped, 5*time.Second, 10*time.Millisecond,
			"inner watcher should be stopped after send timeout")
		for range w.ResultChan() {
		}
		_, open := <-w.ResultChan()
		assert.False(t, open, "wrapper watcher should be stopped after send timeout")
	})

	t.Run("ticker-driven flush does not terminate the watcher", func(t *testing.T) {
		setup := newTestSetup(t)

		fakeWatcher := watch.NewFake()
		watcherStore := &fakeWatcherStorage{K8sStorage: setup.mockStore, watcher: fakeWatcher}
		// Re-create the wrapper with a short flush interval so the ticker case fires.
		setup.wrapper = New(watcherStore, setup.mockAuth, WithWatchFlushInterval(10*time.Millisecond))

		setup.mockAuth.On("WatchFilter", mock.Anything).Return(allowAllWatchFilter, nil)

		w, err := setup.wrapper.Watch(setup.ctx, &internalversion.ListOptions{})
		require.NoError(t, err)
		defer w.Stop()

		// fakeWatcher's inner channel is unbuffered, so Add blocks until the
		// filteredWatcher's run goroutine reads it. If the ticker case kills the
		// run goroutine, Add hangs — do it in a goroutine so the test can fail
		// via time.After instead of hanging the suite.
		add := func(name string) {
			go func() {
				defer func() { _ = recover() }()
				fakeWatcher.Add(&fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: name}})
			}()
		}

		add("first")

		select {
		case event, open := <-w.ResultChan():
			require.True(t, open, "result channel closed before first event was forwarded")
			assert.Equal(t, watch.Added, event.Type)
		case <-time.After(time.Second):
			t.Fatal("did not receive first event within timeout")
		}

		// Wait long enough for several ticker ticks to fire. If the ticker case
		// has its polarity inverted, run() will have exited by now and the
		// second event will never make it through.
		time.Sleep(50 * time.Millisecond)
		add("second")

		select {
		case event, open := <-w.ResultChan():
			require.True(t, open, "result channel closed before second event was forwarded (regression: ticker case polarity)")
			assert.Equal(t, watch.Added, event.Type)
		case <-time.After(time.Second):
			t.Fatal("did not receive second event after ticker tick (regression: ticker case polarity)")
		}
	})
}

// -----
// Fakes
// -----

type FakeAuthorizer struct {
	mock.Mock
}

func (f *FakeAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	args := f.Called(ctx, obj)
	return args.Error(0)
}

func (f *FakeAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	args := f.Called(ctx, oldObj, obj)
	return args.Error(0)
}

func (f *FakeAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	args := f.Called(ctx, obj)
	return args.Error(0)
}

func (f *FakeAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	args := f.Called(ctx, obj)
	return args.Error(0)
}

func (f *FakeAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	args := f.Called(ctx, list)
	var res runtime.Object
	if args.Get(0) != nil {
		res = args.Get(0).(runtime.Object)
	}
	return res, args.Error(1)
}

func (f *FakeAuthorizer) WatchFilter(ctx context.Context) (WatchEventFilter, error) {
	args := f.Called(ctx)
	var filter WatchEventFilter
	if v := args.Get(0); v != nil {
		filter = v.(WatchEventFilter)
	}
	return filter, args.Error(1)
}

type fakeObject struct {
	metaV1.TypeMeta
	metaV1.ObjectMeta
}

func (f *fakeObject) DeepCopyObject() runtime.Object {
	return &fakeObject{
		TypeMeta:   f.TypeMeta,
		ObjectMeta: f.ObjectMeta,
	}
}

// fakeUpdatedObjectInfo implements k8srest.UpdatedObjectInfo for testing
type fakeUpdatedObjectInfo struct {
	obj runtime.Object
}

func (f *fakeUpdatedObjectInfo) Preconditions() *metaV1.Preconditions {
	return nil
}

func (f *fakeUpdatedObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	return f.obj, nil
}

// fakeWatcherStorage wraps K8sStorage and adds Watch support for testing.
type fakeWatcherStorage struct {
	K8sStorage
	watcher   watch.Interface
	assertCtx func(context.Context) bool
	ctxOk     bool
}

func (f *fakeWatcherStorage) Watch(ctx context.Context, _ *internalversion.ListOptions) (watch.Interface, error) {
	if f.assertCtx != nil {
		f.ctxOk = f.assertCtx(ctx)
	}
	return f.watcher, nil
}

// pumpedWatcher is a minimal concurrency-safe watch.Interface used by tests that
// need to push events without racing on Stop (watch.FakeWatcher's Add/Stop are
// not safe to call concurrently).
type pumpedWatcher struct {
	ch       chan watch.Event
	stopOnce sync.Once
	done     atomic.Bool
}

func newPumpedWatcher(buffer int) *pumpedWatcher {
	return &pumpedWatcher{ch: make(chan watch.Event, buffer)}
}

// Events will be written to the channel without blocking.
// If the buffer is full, the event will be dropped.
func (p *pumpedWatcher) push(e watch.Event) {
	select {
	case p.ch <- e:
	default:
		// Buffer full — drop. Tests using this just want to fill the pipeline.
	}
}

func (p *pumpedWatcher) Stop() {
	p.stopOnce.Do(func() { close(p.ch); p.done.Store(true) })
}

func (p *pumpedWatcher) ResultChan() <-chan watch.Event { return p.ch }

func (p *pumpedWatcher) IsStopped() bool { return p.done.Load() }
