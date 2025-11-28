package sql

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestBatch(t *testing.T) {
	t.Parallel()

	t.Run("rv iterator", func(t *testing.T) {
		t.Parallel()

		rv := resource.NewBulkRV()
		v0 := rv.Next(&unstructured.Unstructured{})
		v1 := rv.Next(&unstructured.Unstructured{})
		v2 := rv.Next(&unstructured.Unstructured{})
		require.True(t, v0 > 1000)
		require.Equal(t, int64(1), v1-v0)
		require.Equal(t, int64(1), v2-v1)
	})
}
