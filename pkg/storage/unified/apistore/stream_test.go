package apistore

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestStreamDecoder(t *testing.T) {
	t.Run("toObject should handle internal conversion", func(t *testing.T) {
		called := false
		internalConversion := func(data []byte, obj runtime.Object) (runtime.Object, error) {
			called = true
			return obj, nil
		}

		decoder := &streamDecoder{
			newFunc:            func() runtime.Object { return &unstructured.Unstructured{} },
			internalConversion: internalConversion,
		}

		event := &resource.WatchEvent_Resource{
			Value: []byte("test"),
		}

		obj, err := decoder.toObject(event)
		require.NoError(t, err)
		require.NotNil(t, obj)
		require.True(t, called, "internal conversion function should have been called")
	})
}
