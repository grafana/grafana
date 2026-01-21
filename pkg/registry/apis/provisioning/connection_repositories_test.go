package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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

func (m *mockConnection) GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	return nil, connection.ErrNotImplemented
}

func (m *mockConnection) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	return m.repos, m.err
}

func (m *mockConnection) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return nil, connection.ErrNotImplemented
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

func TestConnectionRepositoriesConnector_WithGitHubConnection(t *testing.T) {
	t.Run("lists repositories from GitHub connection", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		// Create a GitHub connection
		connObj := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-github-connection",
				Namespace: "default",
			},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123456",
					InstallationID: "789012",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("test-token"),
				},
			},
		}

		// Setup GitHub mocks
		mockFactory := github.NewMockGithubFactory(t)
		mockClient := github.NewMockClient(t)

		expectedRepos := []github.Repository{
			{Name: "repo1", Owner: "owner1", URL: "https://github.com/owner1/repo1"},
			{Name: "repo2", Owner: "owner2", URL: "https://github.com/owner2/repo2"},
			{Name: "repo3", Owner: "owner3", URL: "https://github.com/owner3/repo3"},
		}

		mockFactory.EXPECT().
			New(mock.Anything, common.RawSecureValue("test-token")).
			Return(mockClient)
		mockClient.EXPECT().
			ListInstallationRepositories(mock.Anything, "789012").
			Return(expectedRepos, nil)

		// Create GitHub connection
		ghConn := github.NewConnection(
			connObj,
			mockFactory,
			github.ConnectionSecrets{
				Token: common.RawSecureValue("test-token"),
			},
		)

		// Setup connection getter
		mockGetter := &mockConnectionGetter{
			conn: &ghConn,
			err:  nil,
		}

		connector := NewConnectionRepositoriesConnector(mockGetter)

		// Test the endpoint
		handler, err := connector.Connect(ctx, "test-github-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// Verify response
		require.True(t, responder.called)
		require.Nil(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		require.NotNil(t, responder.obj)

		repoList, ok := responder.obj.(*provisioning.ExternalRepositoryList)
		require.True(t, ok)
		require.Len(t, repoList.Items, 3)
		require.Equal(t, "repo1", repoList.Items[0].Name)
		require.Equal(t, "owner1", repoList.Items[0].Owner)
		require.Equal(t, "https://github.com/owner1/repo1", repoList.Items[0].URL)
		require.Equal(t, "repo2", repoList.Items[1].Name)
		require.Equal(t, "owner2", repoList.Items[1].Owner)
		require.Equal(t, "https://github.com/owner2/repo2", repoList.Items[1].URL)
		require.Equal(t, "repo3", repoList.Items[2].Name)
		require.Equal(t, "owner3", repoList.Items[2].Owner)
		require.Equal(t, "https://github.com/owner3/repo3", repoList.Items[2].URL)
	})

	t.Run("returns error when GitHub API fails", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		// Create a GitHub connection
		connObj := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-github-connection",
				Namespace: "default",
			},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123456",
					InstallationID: "789012",
				},
			},
			Secure: provisioning.ConnectionSecure{
				Token: common.InlineSecureValue{
					Create: common.NewSecretValue("test-token"),
				},
			},
		}

		// Setup GitHub mocks to return error
		mockFactory := github.NewMockGithubFactory(t)
		mockClient := github.NewMockClient(t)

		mockFactory.EXPECT().
			New(mock.Anything, common.RawSecureValue("test-token")).
			Return(mockClient)
		mockClient.EXPECT().
			ListInstallationRepositories(mock.Anything, "789012").
			Return(nil, errors.New("github API unavailable"))

		// Create GitHub connection
		ghConn := github.NewConnection(
			connObj,
			mockFactory,
			github.ConnectionSecrets{
				Token: common.RawSecureValue("test-token"),
			},
		)

		// Setup connection getter
		mockGetter := &mockConnectionGetter{
			conn: &ghConn,
			err:  nil,
		}

		connector := NewConnectionRepositoriesConnector(mockGetter)

		// Test the endpoint
		handler, err := connector.Connect(ctx, "test-github-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// Verify error response
		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.True(t, apierrors.IsInternalError(responder.err))
	})

	t.Run("returns NotImplemented for GitLab connection", func(t *testing.T) {
		ctx := context.Background()
		responder := &mockResponder{}

		// Create a mock connection that returns ErrNotImplemented
		mockGetter := &mockConnectionGetter{
			conn: &mockConnection{err: connection.ErrNotImplemented},
			err:  nil,
		}

		connector := NewConnectionRepositoriesConnector(mockGetter)

		handler, err := connector.Connect(ctx, "test-gitlab-connection", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// Verify NotImplemented response
		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		statusErr, ok := responder.err.(*apierrors.StatusError)
		require.True(t, ok)
		require.Equal(t, http.StatusNotImplemented, int(statusErr.ErrStatus.Code))
		require.Equal(t, "NotImplemented", string(statusErr.ErrStatus.Reason))
	})
}
