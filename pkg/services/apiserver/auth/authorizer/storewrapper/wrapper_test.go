package storewrapper

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srest "k8s.io/apiserver/pkg/registry/rest"
)

type testSetup struct {
	store   *fakeStore
	auth    *fakeAuthorizer
	wrapper *Wrapper
	ctx     context.Context
}

func newTestSetup(t *testing.T) *testSetup {
	t.Helper()
	store := &fakeStore{}
	auth := &fakeAuthorizer{}
	wrapper := New(store, auth)

	ctx := identity.WithRequester(
		context.Background(),
		&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
	)

	return &testSetup{store: store, auth: auth, wrapper: wrapper, ctx: ctx}
}

func newTestSetupWithPreserveIdentity(t *testing.T) *testSetup {
	t.Helper()
	store := &fakeStore{}
	auth := &fakeAuthorizer{}
	wrapper := New(store, auth, WithPreserveIdentity())

	ctx := identity.WithRequester(
		context.Background(),
		&identity.StaticRequester{UserUID: "u001", Type: types.TypeUser},
	)

	return &testSetup{store: store, auth: auth, wrapper: wrapper, ctx: ctx}
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
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "created"}}

		setup.store.createObj = expectedObj

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, &metaV1.CreateOptions{})

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)

		// Verify original user identity was used for authorization
		require.True(t, setup.auth.beforeCreateCalled)
		require.True(t, matchesOriginalUser()(setup.auth.beforeCreateCtx))

		// Verify service identity was used for the underlying store call
		require.True(t, setup.store.createCalled)
		require.True(t, matchesServiceIdentity()(setup.store.createCtx))
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{}

		setup.auth.beforeCreateErr = ErrUnauthorized

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, &metaV1.CreateOptions{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)

		// Verify authorization was called with original user
		require.True(t, setup.auth.beforeCreateCalled)
		require.True(t, matchesOriginalUser()(setup.auth.beforeCreateCtx))

		// Verify store was NOT called
		assert.False(t, setup.store.createCalled)
	})
}

func TestWrapper_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)
		version := "1"
		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		deleteOpts := &metaV1.DeleteOptions{Preconditions: &metaV1.Preconditions{ResourceVersion: &version}}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "deleted"}}

		// Get returns the object before deletion
		setup.store.getObj = obj
		// Delete returns the expected object
		setup.store.deleteObj = expectedObj
		setup.store.deleteDeleted = true

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, deleteOpts)

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)
		assert.True(t, deleted)

		// Verify original user identity was used for authorization
		require.True(t, setup.auth.beforeDeleteCalled)
		require.True(t, matchesOriginalUser()(setup.auth.beforeDeleteCtx))

		// Verify service identity was used for store calls
		require.True(t, setup.store.getCalled)
		require.True(t, matchesServiceIdentity()(setup.store.getCtx))
		require.True(t, setup.store.deleteCalled)
		require.True(t, matchesServiceIdentity()(setup.store.deleteCtx))
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)
		version := "1"
		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		deleteOpts := &metaV1.DeleteOptions{Preconditions: &metaV1.Preconditions{ResourceVersion: &version}}

		// Get returns the object before deletion
		setup.store.getObj = obj
		// Authorizer rejects
		setup.auth.beforeDeleteErr = ErrUnauthorized

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, deleteOpts)

		require.Error(t, err)
		assert.Nil(t, result)
		assert.False(t, deleted)
		assert.Equal(t, ErrUnauthorized, err)

		// Verify store.Delete was NOT called
		assert.False(t, setup.store.deleteCalled)
	})
}

func TestWrapper_Get(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}

		setup.store.getObj = obj

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.NoError(t, err)
		assert.Equal(t, obj, result)

		// Verify service identity was used for store call
		require.True(t, setup.store.getCalled)
		require.True(t, matchesServiceIdentity()(setup.store.getCtx))

		// Verify original user identity was used for after-get authorization
		require.True(t, setup.auth.afterGetCalled)
		require.True(t, matchesOriginalUser()(setup.auth.afterGetCtx))
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}

		setup.store.getObj = obj
		setup.auth.afterGetErr = ErrUnauthorized

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)
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

		setup.store.listObj = listObj
		setup.auth.filterListResult = filteredListObj

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.NoError(t, err)
		assert.Equal(t, filteredListObj, result)

		// Verify service identity was used for store call
		require.True(t, setup.store.listCalled)
		require.True(t, matchesServiceIdentity()(setup.store.listCtx))

		// Verify original user identity was used for filtering
		require.True(t, setup.auth.filterListCalled)
		require.True(t, matchesOriginalUser()(setup.auth.filterListCtx))
	})
	t.Run("unauthorized", func(t *testing.T) {
		setup := newTestSetup(t)

		listObj := &metaV1.List{Items: []runtime.RawExtension{
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item1"}}},
			{Object: &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "item2"}}},
		}}

		setup.store.listObj = listObj
		setup.auth.filterListErr = ErrUnauthorized

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, ErrUnauthorized, err)
	})
}

func TestWrapper_Update(t *testing.T) {
	setup := newTestSetup(t)

	oldObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{
		Name: "to-update", ResourceVersion: "2", Labels: map[string]string{"updated": "false"},
	}}
	objInfo := &fakeUpdatedObjectInfo{obj: oldObj}
	updateOpts := &metaV1.UpdateOptions{}

	setup.store.updateObj = oldObj
	setup.store.updateCreated = true

	result, updated, err := setup.wrapper.Update(setup.ctx, "to-update", objInfo, nil, nil, false, updateOpts)
	require.NoError(t, err)
	assert.Equal(t, oldObj, result)
	assert.True(t, updated)

	// Verify service identity was used for store call
	require.True(t, setup.store.updateCalled)
	require.True(t, matchesServiceIdentity()(setup.store.updateCtx))

	// Now verify that the authorization is performed inside UpdatedObject
	// by calling UpdatedObject on the captured authorizedUpdateInfo
	require.NotNil(t, setup.store.updateObjInfo)
	obj, err := setup.store.updateObjInfo.UpdatedObject(context.Background(), oldObj)
	require.NoError(t, err)
	assert.Equal(t, oldObj, obj)

	// Verify the authorizer was called with original user identity
	require.True(t, setup.auth.beforeUpdateCalled)
	require.True(t, matchesOriginalUser()(setup.auth.beforeUpdateCtx))
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
		setup.store.newObj = obj
		assert.Equal(t, obj, setup.wrapper.New())
	})

	t.Run("NewList", func(t *testing.T) {
		obj := &fakeObject{}
		setup.store.newListObj = obj
		assert.Equal(t, obj, setup.wrapper.NewList())
	})

	t.Run("GetSingularName", func(t *testing.T) {
		setup.store.singularName = "fake"
		assert.Equal(t, "fake", setup.wrapper.GetSingularName())
	})

	t.Run("NamespaceScoped", func(t *testing.T) {
		setup.store.namespaceScoped = true
		assert.True(t, setup.wrapper.NamespaceScoped())
	})

	t.Run("Destroy", func(t *testing.T) {
		setup.wrapper.Destroy()
		assert.True(t, setup.store.destroyCalled)
	})

	t.Run("ConvertToTable", func(t *testing.T) {
		obj := &fakeObject{}
		table := &metaV1.Table{}
		setup.store.convertToTableResult = table
		result, err := setup.wrapper.ConvertToTable(setup.ctx, obj, nil)
		require.NoError(t, err)
		assert.Equal(t, table, result)
	})
}

func TestWrapper_WithPreserveIdentity(t *testing.T) {
	t.Run("Create passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{}
		expectedObj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "created"}}

		setup.store.createObj = expectedObj

		result, err := setup.wrapper.Create(setup.ctx, obj, nil, &metaV1.CreateOptions{})

		require.NoError(t, err)
		assert.Equal(t, expectedObj, result)

		// With preserve identity, both authorizer and store should receive original user identity
		require.True(t, matchesOriginalUser()(setup.auth.beforeCreateCtx))
		require.True(t, matchesOriginalUser()(setup.store.createCtx))
	})

	t.Run("Get passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "fetched"}}
		setup.store.getObj = obj

		result, err := setup.wrapper.Get(setup.ctx, "fetched", &metaV1.GetOptions{})

		require.NoError(t, err)
		assert.Equal(t, obj, result)
		require.True(t, matchesOriginalUser()(setup.auth.afterGetCtx))
		require.True(t, matchesOriginalUser()(setup.store.getCtx))
	})

	t.Run("List passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		listObj := &metaV1.List{}
		setup.store.listObj = listObj
		setup.auth.filterListResult = listObj

		result, err := setup.wrapper.List(setup.ctx, &internalversion.ListOptions{})

		require.NoError(t, err)
		assert.Equal(t, listObj, result)
		require.True(t, matchesOriginalUser()(setup.auth.filterListCtx))
		require.True(t, matchesOriginalUser()(setup.store.listCtx))
	})

	t.Run("Delete passes original user identity to inner store", func(t *testing.T) {
		setup := newTestSetupWithPreserveIdentity(t)

		obj := &fakeObject{ObjectMeta: metaV1.ObjectMeta{Name: "to-delete"}}
		setup.store.getObj = obj
		setup.store.deleteObj = obj
		setup.store.deleteDeleted = true

		result, deleted, err := setup.wrapper.Delete(setup.ctx, "to-delete", nil, &metaV1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, obj, result)
		assert.True(t, deleted)
		require.True(t, matchesOriginalUser()(setup.auth.beforeDeleteCtx))
		require.True(t, matchesOriginalUser()(setup.store.getCtx))
		require.True(t, matchesOriginalUser()(setup.store.deleteCtx))
	})
}

// -----
// Fakes
// -----

// fakeAuthorizer implements ResourceStorageAuthorizer with configurable return values
// and captures contexts for identity verification.
type fakeAuthorizer struct {
	beforeCreateErr    error
	beforeCreateCtx    context.Context
	beforeCreateCalled bool

	beforeUpdateErr    error
	beforeUpdateCtx    context.Context
	beforeUpdateCalled bool

	beforeDeleteErr    error
	beforeDeleteCtx    context.Context
	beforeDeleteCalled bool

	afterGetErr    error
	afterGetCtx    context.Context
	afterGetCalled bool

	filterListResult runtime.Object
	filterListErr    error
	filterListCtx    context.Context
	filterListCalled bool
}

func (f *fakeAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	f.beforeCreateCalled = true
	f.beforeCreateCtx = ctx
	return f.beforeCreateErr
}

func (f *fakeAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	f.beforeUpdateCalled = true
	f.beforeUpdateCtx = ctx
	return f.beforeUpdateErr
}

func (f *fakeAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	f.beforeDeleteCalled = true
	f.beforeDeleteCtx = ctx
	return f.beforeDeleteErr
}

func (f *fakeAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	f.afterGetCalled = true
	f.afterGetCtx = ctx
	return f.afterGetErr
}

func (f *fakeAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	f.filterListCalled = true
	f.filterListCtx = ctx
	return f.filterListResult, f.filterListErr
}

// fakeStore implements K8sStorage with configurable return values and call tracking.
type fakeStore struct {
	// New
	newObj runtime.Object

	// NewList
	newListObj runtime.Object

	// Destroy
	destroyCalled bool

	// GetSingularName
	singularName string

	// NamespaceScoped
	namespaceScoped bool

	// Create
	createObj    runtime.Object
	createErr    error
	createCtx    context.Context
	createCalled bool

	// Get
	getObj    runtime.Object
	getErr    error
	getCtx    context.Context
	getCalled bool

	// Update
	updateObj     runtime.Object
	updateCreated bool
	updateErr     error
	updateCtx     context.Context
	updateCalled  bool
	updateObjInfo k8srest.UpdatedObjectInfo

	// Delete
	deleteObj     runtime.Object
	deleteDeleted bool
	deleteErr     error
	deleteCtx     context.Context
	deleteCalled  bool

	// List
	listObj    runtime.Object
	listErr    error
	listCtx    context.Context
	listCalled bool

	// ConvertToTable
	convertToTableResult *metaV1.Table
	convertToTableErr    error
}

func (f *fakeStore) New() runtime.Object     { return f.newObj }
func (f *fakeStore) NewList() runtime.Object { return f.newListObj }
func (f *fakeStore) Destroy()                { f.destroyCalled = true }
func (f *fakeStore) GetSingularName() string { return f.singularName }
func (f *fakeStore) NamespaceScoped() bool   { return f.namespaceScoped }

func (f *fakeStore) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (runtime.Object, error) {
	f.createCalled = true
	f.createCtx = ctx
	return f.createObj, f.createErr
}

func (f *fakeStore) Get(ctx context.Context, name string, options *metaV1.GetOptions) (runtime.Object, error) {
	f.getCalled = true
	f.getCtx = ctx
	return f.getObj, f.getErr
}

func (f *fakeStore) Update(ctx context.Context, name string, objInfo k8srest.UpdatedObjectInfo, createValidation k8srest.ValidateObjectFunc, updateValidation k8srest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metaV1.UpdateOptions) (runtime.Object, bool, error) {
	f.updateCalled = true
	f.updateCtx = ctx
	f.updateObjInfo = objInfo
	return f.updateObj, f.updateCreated, f.updateErr
}

func (f *fakeStore) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	f.deleteCalled = true
	f.deleteCtx = ctx
	return f.deleteObj, f.deleteDeleted, f.deleteErr
}

func (f *fakeStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listCalled = true
	f.listCtx = ctx
	return f.listObj, f.listErr
}

func (f *fakeStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return f.convertToTableResult, f.convertToTableErr
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
