package dashboard

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
)

type mockResourceClient struct {
	mock.Mock
	resource.ResourceClient
}

func (m *mockResourceClient) Restore(ctx context.Context, req *resource.RestoreRequest, opts ...grpc.CallOption) (*resource.RestoreResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*resource.RestoreResponse), args.Error(1)
}

func (m *mockResourceClient) Read(ctx context.Context, req *resource.ReadRequest, opts ...grpc.CallOption) (*resource.ReadResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*resource.ReadResponse), args.Error(1)
}

type mockResponder struct {
	mock.Mock
}

func (m *mockResponder) Object(statusCode int, obj runtime.Object) {
	m.Called(statusCode, obj)
}

func (m *mockResponder) Error(err error) {
	m.Called(err)
}

func TestRestore(t *testing.T) {
	gr := schema.GroupResource{
		Group:    "group",
		Resource: "resource",
	}
	ctx := context.Background()
	mockResponder := &mockResponder{}
	mockClient := &mockResourceClient{}
	r := &restoreREST{
		unified: mockClient,
		gr:      gr,
		opts:    generic.RESTOptions{},
	}

	t.Run("no namespace in context", func(t *testing.T) {
		_, err := r.Connect(ctx, "test-uid", nil, mockResponder)
		assert.Error(t, err)
	})

	ctx = request.WithNamespace(context.Background(), "default")

	t.Run("invalid resourceVersion", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/restore", bytes.NewReader([]byte(`{"resourceVersion":0}`)))
		w := httptest.NewRecorder()

		expectedError := fmt.Errorf("resource version required")
		mockResponder.On("Error", mock.MatchedBy(func(err error) bool {
			return err.Error() == expectedError.Error()
		}))

		handler, err := r.Connect(ctx, "test-uid", nil, mockResponder)
		assert.NoError(t, err)

		handler.ServeHTTP(w, req)
		mockResponder.AssertExpectations(t)
	})

	t.Run("happy path", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/restore", bytes.NewReader([]byte(`{"resourceVersion":123}`)))
		w := httptest.NewRecorder()
		restoreReq := &resource.RestoreRequest{
			ResourceVersion: 123,
			Key: &resource.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "uid",
			},
		}

		expectedObject := &metav1.PartialObjectMetadata{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "uid",
				Namespace:       "default",
				ResourceVersion: strconv.FormatInt(123, 10),
			},
		}

		mockClient.On("Restore", ctx, restoreReq).Return(&resource.RestoreResponse{
			ResourceVersion: 123,
		}, nil).Once()

		mockResponder.On("Object", http.StatusOK, mock.MatchedBy(func(obj interface{}) bool {
			metadata, ok := obj.(*metav1.PartialObjectMetadata)
			return ok &&
				metadata.ObjectMeta.Name == "uid" &&
				metadata.ObjectMeta.Namespace == "default" &&
				metadata.ObjectMeta.ResourceVersion == "123"
		})).Return(expectedObject)

		handler, err := r.Connect(ctx, "uid", nil, mockResponder)
		assert.NoError(t, err)
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		mockClient.AssertExpectations(t)
		mockResponder.AssertExpectations(t)
	})
}
