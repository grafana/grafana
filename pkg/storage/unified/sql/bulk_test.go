package sql

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestBatch(t *testing.T) {
	t.Parallel()

	t.Run("rv iterator", func(t *testing.T) {
		t.Parallel()

		rv := newBulkRV()
		v0 := rv.next(&unstructured.Unstructured{})
		v1 := rv.next(&unstructured.Unstructured{})
		v2 := rv.next(&unstructured.Unstructured{})
		require.True(t, v0 > 1000)
		require.Equal(t, int64(1), v1-v0)
		require.Equal(t, int64(1), v2-v1)
	})
}
