package rest

import (
	"context"
	"testing"

	"github.com/zeebo/assert"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMode2(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode2(lsSpy, sSpy)

	// Create: it should use the Legacy Create implementation
	_, err := dw.Create(context.Background(), &dummyObject{}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Create"))

	// Get: it should read from Storage with LegacyStorage as a fallback
	// #TODO: Currently only testing the happy path. Refactor testing to more easily test other cases.
	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// List: it should use call both Legacy and Storage List methods
	l, err := dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 1, sSpy.Counts("Storage.List"))

	resList, err := meta.ExtractList(l)
	assert.NoError(t, err)

	expectedItems := map[string]string{
		// Item 1: Storage should override Legacy
		"Item 1": "Storage field 1",
		// Item 2 shouldn't be included because it's not in Storage
		// Item 3 should because it's in Legacy
		"Item 3": "Legacy field 3",
	}

	assert.Equal(t, len(expectedItems), len(resList))

	for _, obj := range resList {
		v, ok := obj.(*dummyObject)
		assert.True(t, ok)
		accessor, err := meta.Accessor(v)
		assert.NoError(t, err)

		k, ok := expectedItems[accessor.GetName()]
		assert.True(t, ok)
		assert.Equal(t, k, v.Foo)
	}
}
