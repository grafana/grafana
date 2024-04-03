package rest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

const kind = "dummy"

func Mode1_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode1(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	_, err := dw.Create(context.Background(), dummy, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)

	// it should only store data in LegacyStorage when in mode1 (default)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Create"))

	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// it should use the Legacy List implementation
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 0, sSpy.Counts("Storage.List"))

	// it should use the Legacy Update implementation
	var updated = (rest.UpdatedObjectInfo)(nil)
	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	_, _, err = dw.Update(context.Background(), kind, updated, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Update"))

	// it should use the Legacy Delete implementation
	_, _, err = dw.Delete(context.Background(), kind, validateObjFn, &metav1.DeleteOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Delete"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Delete"))

	// reset storages
	lsSpy.Reset()
	sSpy.Reset()
}

func Mode2_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	createdObj, err := dw.Create(context.Background(), dummy, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)

	res, err := meta.Accessor(createdObj)
	assert.NoError(t, err)
	assert.Equal(t, "", res.GetResourceVersion())

	// it should store in both stores when in mode2
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Create"))

	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// it should use the Legacy List implementation
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 0, sSpy.Counts("Storage.List"))

	// it should update in both storages
	var updated = (rest.UpdatedObjectInfo)(nil)
	updatedObj, err := meta.Accessor(updated)
	assert.NoError(t, err)

	updatedObj.SetResourceVersion("1")
	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	resUpdated, _, err := dw.Update(context.Background(), kind, updated, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Update"))

	ru, err := meta.Accessor(resUpdated)
	assert.NoError(t, err)
	assert.Equal(t, updatedObj.GetResourceVersion(), ru.GetResourceVersion())

	// it should delete in both storages
	_, _, err = dw.Delete(context.Background(), kind, validateObjFn, &metav1.DeleteOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Delete"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Delete"))

	// reset storages
	lsSpy.Reset()
	sSpy.Reset()
}

func Mode3_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode3(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	createdObj, err := dw.Create(context.Background(), dummy, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)

	res, err := meta.Accessor(createdObj)
	assert.NoError(t, err)
	assert.Equal(t, "", res.GetResourceVersion())

	// it should store in both stores when in mode3
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Create"))

	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should read from US
	assert.Equal(t, 0, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// it should read from US
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, sSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 1, sSpy.Counts("Storage.List"))

	// it should update in both storages
	var updated = (rest.UpdatedObjectInfo)(nil)
	updatedObj, err := meta.Accessor(updated)
	assert.NoError(t, err)

	updatedObj.SetResourceVersion("1")
	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	resUpdated, _, err := dw.Update(context.Background(), kind, updated, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Update"))

	ru, err := meta.Accessor(resUpdated)
	assert.NoError(t, err)
	assert.Equal(t, updatedObj.GetResourceVersion(), ru.GetResourceVersion())

	// it should delete in both storages
	_, _, err = dw.Delete(context.Background(), kind, validateObjFn, &metav1.DeleteOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Delete"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Delete"))

	// reset storages
	lsSpy.Reset()
	sSpy.Reset()
}
