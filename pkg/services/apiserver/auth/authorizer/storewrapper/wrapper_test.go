package storewrapper

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

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
	return args.Get(0).(runtime.Object), args.Error(1)
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
