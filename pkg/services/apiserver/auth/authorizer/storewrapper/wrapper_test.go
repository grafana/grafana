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

func TestWrapper_Create(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		mockStore := rest.NewMockStorage(t)
		mockAuth := &FakeAuthorizer{}
		wrapper := New(mockStore, mockAuth)

		ctx := identity.WithRequester(
			context.Background(),
			&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
		)

		obj := &fakeObject{}
		createOpts := &metaV1.CreateOptions{}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "created"}}

		// Verify original user identity is used for authorization
		mockAuth.On("BeforeCreate", mock.MatchedBy(func(ctx context.Context) bool {
			user, err := identity.GetRequester(ctx)
			return err == nil && user.GetUID() == "user:u001"
		}), obj).Return(nil)

		// Verify service identity is used to call the underlying store
		mockStore.On("Create", mock.MatchedBy(func(ctx context.Context) bool {
			return identity.IsServiceIdentity(ctx)
		}), obj, mock.Anything, createOpts).Return(expectedObj, nil)

		result, err := wrapper.Create(ctx, obj, nil, createOpts)

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)

		// Assert expectations
		mockAuth.AssertExpectations(t)
		mockStore.AssertExpectations(t)
	})
	t.Run("unauthorized", func(t *testing.T) {
		mockStore := rest.NewMockStorage(t)
		mockAuth := &FakeAuthorizer{}
		wrapper := New(mockStore, mockAuth)

		ctx := identity.WithRequester(
			context.Background(),
			&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
		)

		obj := &fakeObject{}
		createOpts := &metaV1.CreateOptions{}

		// Simulate unauthorized error from authorizer
		mockAuth.On("BeforeCreate", mock.Anything, obj).Return(ErrUnauthorized)

		result, err := wrapper.Create(ctx, obj, nil, createOpts)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)

		// Assert expectations
		mockAuth.AssertExpectations(t)
		mockStore.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}
