package rest

import (
	"context"
	"testing"

	"github.com/zeebo/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))
}

func Mode2_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))
}

func Mode3_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode3(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Unified Storage Get implementation
	assert.Equal(t, 0, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))
}

func Mode4_Test(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode3(lsSpy, sSpy)

	var dummy = (runtime.Object)(nil)
	assert.NotNil(t, dummy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Unified Storage Get implementation
	assert.Equal(t, 0, sSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))
}
