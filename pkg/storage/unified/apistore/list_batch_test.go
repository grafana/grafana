package apistore

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type batchListClient struct {
	resource.ResourceClient
	response *resourcepb.ListResponse
}

func (c batchListClient) List(context.Context, *resourcepb.ListRequest, ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return c.response, nil
}

type batchListSerializer struct {
	Serializer
	batch func(context.Context, [][]byte) ([]runtime.Object, error)
}

func (s batchListSerializer) DecodeBatch(ctx context.Context, data [][]byte) ([]runtime.Object, error) {
	return s.batch(ctx, data)
}

func decodeListBatch(ctx context.Context, data [][]byte) ([]runtime.Object, error) {
	result := make([]runtime.Object, len(data))
	for i, raw := range data {
		obj, err := JSONSerializer().Decode(ctx, raw, nil)
		if err != nil {
			return nil, err
		}
		result[i] = obj
	}
	return result, nil
}

func listBatchResponse(t *testing.T, count, padding int) *resourcepb.ListResponse {
	t.Helper()
	response := &resourcepb.ListResponse{ResourceVersion: 1000, NextPageToken: "next", RemainingItemCount: 3}
	for i := 0; i < count; i++ {
		value := []byte(fmt.Sprintf(`{"apiVersion":"example.grafana.app/v1","kind":"Example","metadata":{"name":"item-%d","labels":{"keep":"%t"}},"spec":{"padding":"%s"}}`, i, i%2 == 0, strings.Repeat("x", padding)))
		response.Items = append(response.Items, &resourcepb.ResourceWrapper{Value: value, ResourceVersion: int64(i + 1)})
	}
	return response
}

func TestGetListBatchDecoding(t *testing.T) {
	for _, tc := range []struct {
		name           string
		count, padding int
		want           []int
	}{
		{"empty", 0, 0, nil},
		{"small page", 5, 0, []int{5}},
		{"default page", 500, 0, []int{500}},
		{"larger requested page", 1000, 0, []int{1000}},
		{"large objects", 3, 600 * 1024, []int{3}},
		{"page exceeding byte budget by one item", 4, 600 * 1024, []int{4}},
		{"oversized individual item", 1, 2 * 1024 * 1024, []int{1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := testStorage(t, batchListClient{response: listBatchResponse(t, tc.count, tc.padding)})
			var sizes []int
			next := 0
			s.serializer = batchListSerializer{batch: func(ctx context.Context, data [][]byte) ([]runtime.Object, error) {
				sizes = append(sizes, len(data))
				objs, err := decodeListBatch(ctx, data)
				require.NoError(t, err)
				for _, obj := range objs {
					require.Equal(t, fmt.Sprintf("item-%d", next), obj.(*unstructured.Unstructured).GetName())
					next++
				}
				return objs, nil
			}}
			list := &unstructured.UnstructuredList{}
			require.NoError(t, s.GetList(t.Context(), "ignored", storage.ListOptions{Predicate: storage.Everything}, list))
			require.Equal(t, tc.want, sizes)
			require.Len(t, list.Items, tc.count)
			for i, obj := range list.Items {
				require.Equal(t, fmt.Sprintf("item-%d", i), obj.GetName())
				require.Equal(t, strconv.Itoa(i+1), obj.GetResourceVersion())
			}
			require.Equal(t, "1000", list.GetResourceVersion())
			require.Equal(t, "next", list.GetContinue())
			require.EqualValues(t, 3, *list.GetRemainingItemCount())
		})
	}
}

func TestGetListBatchDecodingFilters(t *testing.T) {
	for _, batch := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch=%t", batch), func(t *testing.T) {
			s := testStorage(t, batchListClient{response: listBatchResponse(t, 5, 0)})
			if batch {
				s.serializer = batchListSerializer{batch: decodeListBatch}
			}
			predicate := storage.SelectionPredicate{Label: labels.SelectorFromSet(labels.Set{"keep": "true"}), Field: fields.Everything(), GetAttrs: func(obj runtime.Object) (labels.Set, fields.Set, error) {
				return obj.(*unstructured.Unstructured).GetLabels(), nil, nil
			}}
			list := &unstructured.UnstructuredList{}
			require.NoError(t, s.GetList(t.Context(), "ignored", storage.ListOptions{Predicate: predicate, ResourceVersion: "3", ResourceVersionMatch: metav1.ResourceVersionMatchExact}, list))
			require.Len(t, list.Items, 1)
			require.Equal(t, "item-2", list.Items[0].GetName())
		})
	}
}

func TestGetListBatchDecodingFailure(t *testing.T) {
	for _, mode := range []string{"error", "wrong count", "nil object", "canceled"} {
		t.Run(mode, func(t *testing.T) {
			s := testStorage(t, batchListClient{response: listBatchResponse(t, 205, 0)})
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			calls := 0
			failure := errors.New("conversion failed")
			s.serializer = batchListSerializer{batch: func(ctx context.Context, data [][]byte) ([]runtime.Object, error) {
				calls++

				switch mode {
				case "error":
					return nil, failure
				case "canceled":
					cancel()
					return decodeListBatch(ctx, data)
				case "wrong count":
					return []runtime.Object{}, nil
				default:
					objects, err := decodeListBatch(ctx, data)
					require.NoError(t, err)
					objects[len(objects)-1] = nil
					return objects, nil
				}
			}}
			list := &unstructured.UnstructuredList{}
			err := s.GetList(ctx, "ignored", storage.ListOptions{Predicate: storage.Everything}, list)
			require.Error(t, err)
			if mode == "error" {
				require.ErrorIs(t, err, failure)
			}
			if mode == "canceled" {
				require.ErrorIs(t, err, context.Canceled)
			}
			require.Equal(t, 1, calls)
			require.Empty(t, list.Items, "failed batches must not expose a partial result")
			require.Empty(t, list.GetResourceVersion())
		})
	}
}
