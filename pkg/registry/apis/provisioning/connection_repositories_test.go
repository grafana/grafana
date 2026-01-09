package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestConnectionRepositoriesConnector(t *testing.T) {
	connector := NewConnectionRepositoriesConnector()

	t.Run("New returns ExternalRepositoryList", func(t *testing.T) {
		obj := connector.New()
		require.IsType(t, &provisioning.ExternalRepositoryList{}, obj)
	})

	t.Run("ProducesMIMETypes returns application/json", func(t *testing.T) {
		types := connector.ProducesMIMETypes("GET")
		require.Equal(t, []string{"application/json"}, types)
	})

	t.Run("ProducesObject returns ExternalRepositoryList", func(t *testing.T) {
		obj := connector.ProducesObject("GET")
		require.IsType(t, &provisioning.ExternalRepositoryList{}, obj)
	})

	t.Run("ConnectMethods returns GET", func(t *testing.T) {
		methods := connector.ConnectMethods()
		require.Equal(t, []string{http.MethodGet}, methods)
	})

	t.Run("NewConnectOptions returns no path component", func(t *testing.T) {
		obj, hasPath, path := connector.NewConnectOptions()
		require.Nil(t, obj)
		require.False(t, hasPath)
		require.Empty(t, path)
	})

	t.Run("Connect returns handler that rejects non-GET methods", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		handler, err := connector.Connect(ctx, "test-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		// Test POST method (should be rejected)
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.True(t, apierrors.IsMethodNotSupported(responder.err))
	})

	t.Run("Connect returns handler that returns not implemented for GET", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		handler, err := connector.Connect(ctx, "test-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		// Test GET method (should return not implemented)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.True(t, apierrors.IsMethodNotSupported(responder.err))
		require.Contains(t, responder.err.Error(), "not yet implemented")
	})
}

// mockResponder implements rest.Responder for testing
type mockResponder struct {
	called bool
	err    error
	obj    runtime.Object
	code   int
}

func (m *mockResponder) Object(statusCode int, obj runtime.Object) {
	m.called = true
	m.code = statusCode
	m.obj = obj
}

func (m *mockResponder) Error(err error) {
	m.called = true
	m.err = err
}
