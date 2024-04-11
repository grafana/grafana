package rest

import (
	"context"
	"testing"

	"github.com/zeebo/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/registry/rest"
)

const kind = "dummy"

func Test_Mode1(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode1(lsSpy, sSpy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// it should use the Legacy Update implementation
	var updated = (rest.UpdatedObjectInfo)(nil)
	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	_, _, err = dw.Update(context.Background(), kind, updated, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Update"))
}

func Test_Mode2(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// // it should use the Legacy Get implementation
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))

	// it should update in both storages
	dummy := &example.Pod{}
	uoi := UpdatedObjInfoObj{}
	_, err = uoi.UpdatedObject(context.Background(), dummy)
	assert.NoError(t, err)

	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	_, _, err = dw.Update(context.Background(), kind, uoi, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Update"))
	assert.NoError(t, err)
}

func Mode3_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode3(lsSpy, sSpy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Unified Storage Get implementation
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// it should update in both storages
	dummy := &example.Pod{}
	uoi := UpdatedObjInfoObj{}
	uoi.UpdatedObject(context.Background(), dummy)

	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	_, _, err = dw.Update(context.Background(), kind, uoi, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Update"))
	assert.NoError(t, err)
}

func Test_Mode4(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode4(lsSpy, sSpy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Unified Storage Get implementation
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// it should update only US
	dummy := &example.Pod{}
	uoi := UpdatedObjInfoObj{}
	uoi.UpdatedObject(context.Background(), dummy)

	var validateObjFn = func(ctx context.Context, obj runtime.Object) error { return nil }
	var validateObjUpdateFn = func(ctx context.Context, obj, old runtime.Object) error { return nil }

	_, _, err = dw.Update(context.Background(), kind, uoi, validateObjFn, validateObjUpdateFn, false, &metav1.UpdateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Update"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Update"))
	assert.NoError(t, err)
}
