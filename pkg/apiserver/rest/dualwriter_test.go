package rest

import (
	"context"
	"testing"

	"github.com/zeebo/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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
}

func Test_Mode2(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)

	// it should use the Legacy Get implementation
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 0, sSpy.Counts("Storage.Get"))
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
}

func Test_Mode4(t *testing.T) {
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
}
