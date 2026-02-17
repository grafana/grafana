package storewrapper

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

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
	setup.mockAuth.On("BeforeUpdate", mock.MatchedBy(matchesOriginalUser()), oldObj).Return(nil)
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
	assert.Contains(t, err.Error(), "bulk delete operations are not supported")
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

func (f *FakeAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	args := f.Called(ctx, obj)
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

func TestWrapper_List_PaginationWithFiltering(t *testing.T) {
	t.Run("fetches multiple pages until limit is satisfied", func(t *testing.T) {
		setup := newTestSetup(t)

		// Create a list of 10 items for first page
		firstPageItems := make([]runtime.RawExtension, 10)
		for i := 0; i < 10; i++ {
			firstPageItems[i] = runtime.RawExtension{
				Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: fmt.Sprintf("item%d", i)}},
			}
		}
		firstPageList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: "token1"},
			Items:    firstPageItems,
		}

		// Create a list of 10 items for second page
		secondPageItems := make([]runtime.RawExtension, 10)
		for i := 10; i < 20; i++ {
			secondPageItems[i-10] = runtime.RawExtension{
				Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: fmt.Sprintf("item%d", i)}},
			}
		}
		secondPageList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    secondPageItems,
		}

		// First fetch - returns 10 items with continue token
		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()),
			mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
				return opts.Limit == 30 && opts.Continue == "" // 10 * 3 multiplier
			})).Return(firstPageList, nil).Once()

		// Filter first page down to only 3 items (simulating heavy filtering)
		filteredFirstPage := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: "token1"},
			Items: []runtime.RawExtension{
				firstPageItems[0], firstPageItems[1], firstPageItems[2],
			},
		}
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), firstPageList).
			Return(filteredFirstPage, nil).Once()

		// Second fetch - to get more items since we only have 3 so far
		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()),
			mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
				return opts.Limit == 21 && opts.Continue == "token1" // (10-3) * 3 multiplier
			})).Return(secondPageList, nil).Once()

		// Filter second page down to 8 items
		filteredSecondPage := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    secondPageItems[:8],
		}
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), secondPageList).
			Return(filteredSecondPage, nil).Once()

		// Request 10 items
		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 10})

		require.NoError(t, err)
		resultList, ok := result.(*metaV1.List)
		require.True(t, ok, "result should be a *metaV1.List")

		// Should have exactly 10 items (3 from first page + 7 from second page, truncated to limit)
		assert.Equal(t, 10, len(resultList.Items))
		assert.Equal(t, "", resultList.Continue) // No more items available

		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})

	t.Run("returns early when no continue token", func(t *testing.T) {
		setup := newTestSetup(t)

		// Single page with no continue token
		singlePageItems := make([]runtime.RawExtension, 5)
		for i := 0; i < 5; i++ {
			singlePageItems[i] = runtime.RawExtension{
				Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: fmt.Sprintf("item%d", i)}},
			}
		}
		singlePageList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    singlePageItems,
		}

		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).
			Return(singlePageList, nil).Once()

		filteredList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    singlePageItems[:3], // Filter down to 3
		}
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), singlePageList).
			Return(filteredList, nil).Once()

		// Request 10 items but only 3 available after filtering
		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 10})

		require.NoError(t, err)
		resultList, ok := result.(*metaV1.List)
		require.True(t, ok)

		// Should only have 3 items since that's all that's available
		assert.Equal(t, 3, len(resultList.Items))
		assert.Equal(t, "", resultList.Continue)

		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})

	t.Run("handles limit of zero by fetching all without pagination loop", func(t *testing.T) {
		setup := newTestSetup(t)

		items := make([]runtime.RawExtension, 100)
		for i := 0; i < 100; i++ {
			items[i] = runtime.RawExtension{
				Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: fmt.Sprintf("item%d", i)}},
			}
		}
		allItemsList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    items,
		}

		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()),
			mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
				return opts.Limit == 0 // Should pass limit 0 through
			})).Return(allItemsList, nil).Once()

		filteredList := &metaV1.List{
			ListMeta: metaV1.ListMeta{Continue: ""},
			Items:    items[:50], // Filter to 50
		}
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), allItemsList).
			Return(filteredList, nil).Once()

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 0})

		require.NoError(t, err)
		resultList, ok := result.(*metaV1.List)
		require.True(t, ok)
		assert.Equal(t, 50, len(resultList.Items))

		// Should only call List once (no pagination loop)
		setup.mockStore.AssertNumberOfCalls(t, "List", 1)
		setup.mockAuth.AssertExpectations(t)
	})

	t.Run("respects max iterations limit", func(t *testing.T) {
		setup := newTestSetup(t)

		// Mock storage to always return items with continue token (infinite pagination scenario)
		// This tests the maxIterations safety limit

		// We'll create unique items for each call to distinguish them
		for i := 0; i < 10; i++ {
			pageItems := make([]runtime.RawExtension, 5)
			for j := 0; j < 5; j++ {
				pageItems[j] = runtime.RawExtension{
					Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: fmt.Sprintf("item%d-%d", i, j)}},
				}
			}

			pageList := &metaV1.List{
				ListMeta: metaV1.ListMeta{Continue: fmt.Sprintf("token%d", i+1)},
				Items:    pageItems,
			}

			setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).
				Return(pageList, nil).Once()

			filteredPage := &metaV1.List{
				ListMeta: metaV1.ListMeta{Continue: fmt.Sprintf("token%d", i+1)},
				Items:    pageItems[:1], // Only 1 item passes filter per call
			}
			setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), pageList).
				Return(filteredPage, nil).Once()
		}

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 100})

		require.NoError(t, err)
		resultList, ok := result.(*metaV1.List)
		require.True(t, ok)

		// Should have 10 items (1 per iteration * 10 maxIterations)
		// Even though we requested 100, we stop at 10 due to maxIterations
		assert.Equal(t, 10, len(resultList.Items))
		// Continue token should be empty because we collected fewer items than requested
		// (This indicates we exhausted iterations, not that we reached the limit)
		assert.Empty(t, resultList.Continue)

		setup.mockStore.AssertExpectations(t)
		setup.mockAuth.AssertExpectations(t)
	})

	t.Run("propagates storage errors", func(t *testing.T) {
		setup := newTestSetup(t)

		storageErr := errors.NewInternalError(fmt.Errorf("storage error"))
		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).
			Return(nil, storageErr).Once()

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 10})

		require.Error(t, err)
		assert.Equal(t, storageErr, err)
		assert.Nil(t, result)

		setup.mockStore.AssertExpectations(t)
	})

	t.Run("propagates filter errors", func(t *testing.T) {
		setup := newTestSetup(t)

		pageList := &metaV1.List{
			Items: []runtime.RawExtension{
				{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item1"}}},
			},
		}

		setup.mockStore.On("List", mock.MatchedBy(matchesServiceIdentity()), mock.Anything).
			Return(pageList, nil).Once()

		filterErr := ErrUnauthorized
		setup.mockAuth.On("FilterList", mock.MatchedBy(matchesOriginalUser()), pageList).
			Return(nil, filterErr).Once()

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{Limit: 10})

		require.Error(t, err)
		assert.Equal(t, filterErr, err)
		assert.Nil(t, result)

		setup.mockAuth.AssertExpectations(t)
		setup.mockStore.AssertExpectations(t)
	})
}
