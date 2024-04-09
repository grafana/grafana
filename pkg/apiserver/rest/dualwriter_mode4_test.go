package rest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMode4(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode4(lsSpy, sSpy)

	// Get: it should use the Storage Get implementation
	_, err := dw.Get(context.Background(), kind, &metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.Get"))
	assert.Equal(t, 1, sSpy.Counts("Storage.Get"))

	// List: it should use the Storage Get implementation
	_, err = dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 0, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 1, sSpy.Counts("Storage.List"))
}
