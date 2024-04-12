package rest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestMode3(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode3(lsSpy, sSpy)

	// Create: it should use the Legacy Create implementation
	_, err := dw.Create(context.Background(), &dummyObject{}, func(context.Context, runtime.Object) error { return nil }, &metav1.CreateOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.Create"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Create"))

	// Get: it should use the Storage Get implementation
	_, err = dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// List: it should use the Storage List implementation
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 1, sSpy.Counts("Storage.List"))
}
