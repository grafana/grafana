package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
)

func TestLatest(t *testing.T) {
	gr := schema.GroupResource{
		Group:    "group",
		Resource: "resource",
	}
	ctx := context.Background()
	mockResponder := &mockResponder{}
	mockClient := &mockResourceClient{}
	r := &latestREST{
		unified: mockClient,
		gr:      gr,
		opts:    generic.RESTOptions{},
	}

	t.Run("no namespace in context", func(t *testing.T) {
		_, err := r.Connect(ctx, "test-uid", nil, mockResponder)
		require.Error(t, err)
	})

	ctx = request.WithNamespace(context.Background(), "default")

	t.Run("happy path", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/latest", nil)
		w := httptest.NewRecorder()

		readReq := &resource.ReadRequest{
			Key: &resource.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "uid",
			},
			ResourceVersion: 0,
			IncludeDeleted:  true,
		}

		expectedObject := &metav1.PartialObjectMetadata{
			TypeMeta: metav1.TypeMeta{
				Kind:       "resource",
				APIVersion: "v0alpha1",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:            "uid",
				Namespace:       "default",
				ResourceVersion: strconv.FormatInt(123, 10),
			},
		}

		val, err := json.Marshal(expectedObject)
		require.NoError(t, err)
		mockClient.On("Read", ctx, readReq).Return(&resource.ReadResponse{
			ResourceVersion: 123,
			Value:           val,
		}, nil).Once()

		mockResponder.On("Object", http.StatusOK, mock.MatchedBy(func(obj interface{}) bool {
			unstructuredObj, ok := obj.(*unstructured.Unstructured)
			expectedMap := map[string]interface{}{
				"apiVersion": expectedObject.APIVersion,
				"kind":       expectedObject.Kind,
				"metadata": map[string]interface{}{
					"name":              expectedObject.Name,
					"namespace":         expectedObject.Namespace,
					"resourceVersion":   expectedObject.ResourceVersion,
					"creationTimestamp": nil,
				},
			}
			return ok && reflect.DeepEqual(unstructuredObj.Object, expectedMap)
		}))

		handler, err := r.Connect(ctx, "uid", nil, mockResponder)
		require.NoError(t, err)
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		mockClient.AssertExpectations(t)
		mockResponder.AssertExpectations(t)
	})
}
