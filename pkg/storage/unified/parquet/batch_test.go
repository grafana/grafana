package parquet

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestParquetWriteThenRead(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "temp-*.parquet")
	require.NoError(t, err)
	//defer os.Remove(file.Name())

	writer, err := NewResourceWriter(file)
	require.NoError(t, err)
	ctx := context.Background()

	require.NoError(t, writer.Add(toKeyAndBytes(ctx, "ggg", "rrr", &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"namespace":       "ns",
				"name":            "aaa",
				"resourceVersion": "1234",
				"annotations": map[string]string{
					utils.AnnoKeyFolder: "xyz",
				},
			},
			"spec": map[string]any{
				"hello": "first",
			},
		},
	})))

	require.NoError(t, writer.Add(toKeyAndBytes(ctx, "ggg", "rrr", &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"namespace":       "ns",
				"name":            "bbb",
				"resourceVersion": "5678",
				"generation":      -999, // deleted action
			},
			"spec": map[string]any{
				"hello": "second",
			},
		},
	})))

	require.NoError(t, writer.Add(toKeyAndBytes(ctx, "ggg", "rrr", &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"namespace":       "ns",
				"name":            "ccc",
				"resourceVersion": "789",
				"generation":      3, // modified action
			},
			"spec": map[string]any{
				"hello": "thirt",
			},
		},
	})))

	err = writer.Close()
	require.NoError(t, err)

	var keys []string
	reader, err := NewResourceReader(file.Name(), 20)
	require.NoError(t, err)
	for reader.Next() {
		req := reader.Request()
		keys = append(keys, req.Key.SearchID())
		//fmt.Printf("ROW: %+v\n", req.Key)
	}

	// Verify that we read all values
	require.Equal(t, []string{
		"rrr/ns/ggg/aaa",
		"rrr/ns/ggg/bbb",
		"rrr/ns/ggg/ccc",
	}, keys)
}

func toKeyAndBytes(ctx context.Context, group string, res string, obj *unstructured.Unstructured) (context.Context, *resource.ResourceKey, []byte) {
	if obj.GetKind() == "" {
		obj.SetKind(res)
	}
	if obj.GetAPIVersion() == "" {
		obj.SetAPIVersion(group + "/vXyz")
	}
	data, _ := obj.MarshalJSON()
	return ctx, &resource.ResourceKey{
		Namespace: obj.GetNamespace(),
		Resource:  res,
		Group:     group,
		Name:      obj.GetName(),
	}, data
}
