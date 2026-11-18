package apistore

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestGetListItemsUseDeclaredVersion(t *testing.T) {
	response := &resourcepb.ListResponse{ResourceVersion: 10}
	for i, raw := range []string{
		`{"apiVersion":"example.grafana.app/v1","kind":"Example","metadata":{"name":"a"}}`,
		`{"apiVersion":"example.grafana.app/v1beta1","kind":"Example","metadata":{"name":"b"}}`,
		`{"apiVersion":"other.grafana.app/v0alpha1","kind":"Example","metadata":{"name":"c"}}`,
	} {
		response.Items = append(response.Items, &resourcepb.ResourceWrapper{Value: []byte(raw), ResourceVersion: int64(i + 1)})
	}

	for _, batch := range []bool{false, true} {
		s := testStorage(t, batchListClient{response: response})
		s.opts.GVK = schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1", Kind: "Example"}
		if batch {
			s.serializer = batchListSerializer{batch: decodeListBatch}
		}
		list := &unstructured.UnstructuredList{}
		require.NoError(t, s.GetList(t.Context(), "ignored", storage.ListOptions{Predicate: storage.Everything}, list))
		require.Len(t, list.Items, 3)
		require.Equal(t, "example.grafana.app/v1", list.Items[0].GetAPIVersion())
		require.Equal(t, "example.grafana.app/v1", list.Items[1].GetAPIVersion())
		require.Equal(t, "other.grafana.app/v0alpha1", list.Items[2].GetAPIVersion())
	}
}
