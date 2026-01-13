package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
)

// mockConnectionGetter implements ConnectionGetter for testing
type mockConnectionGetter struct {
	conn connection.Connection
	err  error
}

func (m *mockConnectionGetter) GetConnection(ctx context.Context, name string) (connection.Connection, error) {
	return m.conn, m.err
}

// mockConnection implements connection.Connection for testing
type mockConnection struct {
	repos []provisioning.ExternalRepository
	err   error
}

func (m *mockConnection) Validate(ctx context.Context) error {
	return nil
}

func (m *mockConnection) Mutate(ctx context.Context) error {
	return nil
}

func (m *mockConnection) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	return m.repos, m.err
}

func TestConnectionRepositoriesConnector(t *testing.T) {
	mockGetter := &mockConnectionGetter{}
	connector := NewConnectionRepositoriesConnector(mockGetter)

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

	t.Run("Connect returns handler that returns error when connection not found", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		mockGetter.conn = nil
		mockGetter.err = apierrors.NewNotFound(provisioning.ConnectionResourceInfo.GroupResource(), "test-connection")

		handler, err := connector.Connect(ctx, "test-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.True(t, apierrors.IsNotFound(responder.err))
	})

	t.Run("Connect returns handler that lists repositories successfully", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		expectedRepos := []provisioning.ExternalRepository{
			{Name: "repo1", Owner: "owner1", URL: "https://github.com/owner1/repo1"},
			{Name: "repo2", Owner: "owner2", URL: "https://github.com/owner2/repo2"},
		}

		mockGetter.conn = &mockConnection{repos: expectedRepos}
		mockGetter.err = nil

		handler, err := connector.Connect(ctx, "test-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.Nil(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.NotNil(t, responder.obj)

		repoList, ok := responder.obj.(*provisioning.ExternalRepositoryList)
		require.True(t, ok)
		require.Len(t, repoList.Items, 2)
		require.Equal(t, expectedRepos, repoList.Items)
	})

	t.Run("Connect returns handler that returns error when listing repositories fails", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		mockGetter.conn = &mockConnection{err: errors.New("github API error")}
		mockGetter.err = nil

		handler, err := connector.Connect(ctx, "test-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.True(t, apierrors.IsInternalError(responder.err))
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
