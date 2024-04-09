package rest

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

const kind = "dummy"

func TestMode1(t *testing.T) {
	var ls = (LegacyStorage)(nil)
	var s = (Storage)(nil)
	lsSpy := NewLegacyStorageSpyClient(ls)
	sSpy := NewStorageSpyClient(s)

	dw := NewDualWriterMode1(lsSpy, sSpy)

	_, err := dw.List(context.Background(), &metainternalversion.ListOptions{})
	assert.NoError(t, err)
	assert.Equal(t, 1, lsSpy.Counts("LegacyStorage.List"))
	assert.Equal(t, 0, sSpy.Counts("Storage.List"))

}
