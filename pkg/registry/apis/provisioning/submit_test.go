package provisioning

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type submittableRepository struct {
	*repository.MockConfigRepository
	*repository.MockPullRequestSubmitter
}

type userAuthorizingConnection struct {
	*connection.MockConnection
	*connection.MockUserAuthorizer
}

const validSubmission = `{"spec":{"ref":"feature","title":"Add dashboard","description":"Made in Grafana","code":"abc","redirectURI":"https://grafana.example/callback"}}`

func TestSubmitConnector(t *testing.T) {
	t.Run("opens the pull request as the user who authorized the code", func(t *testing.T) {
		repo := newSubmittableRepository(t, testSubmitRepository("oauth-connection"))
		conn := newUserAuthorizingConnection(t)
		conn.MockUserAuthorizer.EXPECT().
			ExchangeUserAuthorizationCode(mock.Anything, "abc", "https://grafana.example/callback").
			Return(common.RawSecureValue("user-token"), nil)
		repo.MockPullRequestSubmitter.EXPECT().
			SubmitPullRequest(mock.Anything, common.RawSecureValue("user-token"), repository.NewPullRequest{
				Head:  "feature",
				Title: "Add dashboard",
				Body:  "Made in Grafana",
			}).
			Return(&repository.SubmittedPullRequest{Number: 42, URL: "https://github.com/grafana/grafana/pull/42"}, nil)
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").Return(repo, nil)
		access.EXPECT().GetConnection(mock.Anything, "oauth-connection").Return(conn, nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		res, ok := responder.obj.(*provisioning.PullRequestSubmission)
		require.True(t, ok)
		require.Equal(t, provisioning.PullRequestSubmissionStatus{Number: 42, URL: "https://github.com/grafana/grafana/pull/42"}, res.Status)
		require.Empty(t, res.Spec.Code, "the authorization code must not be echoed back")
	})

	t.Run("rejects non-POST methods", func(t *testing.T) {
		responder := serveSubmit(t, NewMockSubmitAccess(t), http.MethodGet, "")

		require.True(t, apierrors.IsMethodNotSupported(responder.err))
	})

	for name, body := range map[string]string{
		"missing ref":   `{"spec":{"title":"t","code":"abc"}}`,
		"missing title": `{"spec":{"ref":"feature","code":"abc"}}`,
		"missing code":  `{"spec":{"ref":"feature","title":"t"}}`,
		"unknown field": `{"spec":{"ref":"feature","title":"t","code":"abc","bogus":true}}`,
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			responder := serveSubmit(t, NewMockSubmitAccess(t), http.MethodPost, body)

			require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
		})
	}

	t.Run("rejects a ref that is the repository branch", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").
			Return(newSubmittableRepository(t, testSubmitRepository("oauth-connection")), nil)

		responder := serveSubmit(t, access, http.MethodPost, `{"spec":{"ref":"main","title":"t","code":"abc"}}`)

		require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
	})

	t.Run("returns the error when the repository cannot be found", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").
			Return(nil, apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), "test-repo"))

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.True(t, apierrors.IsNotFound(responder.err))
	})

	t.Run("returns NotImplemented for repositories that cannot submit pull requests", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").Return(repository.NewMockConfigRepository(t), nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		requireStatusCode(t, responder.err, http.StatusNotImplemented)
	})

	t.Run("returns NotImplemented for repositories without a connection", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").
			Return(newSubmittableRepository(t, testSubmitRepository("")), nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		requireStatusCode(t, responder.err, http.StatusNotImplemented)
	})

	t.Run("returns NotImplemented for connections that cannot act as the user", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").
			Return(newSubmittableRepository(t, testSubmitRepository("app-connection")), nil)
		access.EXPECT().GetConnection(mock.Anything, "app-connection").Return(connection.NewMockConnection(t), nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		requireStatusCode(t, responder.err, http.StatusNotImplemented)
	})

	t.Run("returns BadRequest when the provider rejects the code", func(t *testing.T) {
		conn := newUserAuthorizingConnection(t)
		conn.MockUserAuthorizer.EXPECT().
			ExchangeUserAuthorizationCode(mock.Anything, "abc", "https://grafana.example/callback").
			Return("", errors.New("bad_verification_code"))
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").
			Return(newSubmittableRepository(t, testSubmitRepository("oauth-connection")), nil)
		access.EXPECT().GetConnection(mock.Anything, "oauth-connection").Return(conn, nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
	})

	t.Run("returns the provider's status when the pull request is rejected", func(t *testing.T) {
		repo := newSubmittableRepository(t, testSubmitRepository("oauth-connection"))
		repo.MockPullRequestSubmitter.EXPECT().
			SubmitPullRequest(mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrPermissionDenied)
		conn := newUserAuthorizingConnection(t)
		conn.MockUserAuthorizer.EXPECT().
			ExchangeUserAuthorizationCode(mock.Anything, mock.Anything, mock.Anything).
			Return(common.RawSecureValue("user-token"), nil)
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetRepository(mock.Anything, "test-repo").Return(repo, nil)
		access.EXPECT().GetConnection(mock.Anything, "oauth-connection").Return(conn, nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.True(t, apierrors.IsForbidden(responder.err), "got %v", responder.err)
	})
}

func serveSubmit(t *testing.T, access SubmitAccess, method, body string) *mockResponder {
	t.Helper()

	responder := &mockResponder{}
	handler, err := NewSubmitConnector(access).Connect(t.Context(), "test-repo", nil, responder)
	require.NoError(t, err)

	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.True(t, responder.called)
	return responder
}

func newSubmittableRepository(t *testing.T, cfg *provisioning.Repository) *submittableRepository {
	repo := &submittableRepository{
		MockConfigRepository:     repository.NewMockConfigRepository(t),
		MockPullRequestSubmitter: repository.NewMockPullRequestSubmitter(t),
	}
	repo.MockConfigRepository.EXPECT().Config().Return(cfg).Maybe()
	return repo
}

func newUserAuthorizingConnection(t *testing.T) *userAuthorizingConnection {
	return &userAuthorizingConnection{
		MockConnection:     connection.NewMockConnection(t),
		MockUserAuthorizer: connection.NewMockUserAuthorizer(t),
	}
}

func testSubmitRepository(connectionName string) *provisioning.Repository {
	cfg := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/grafana",
				Branch: "main",
			},
		},
	}
	if connectionName != "" {
		cfg.Spec.Connection = &provisioning.ConnectionInfo{Name: connectionName}
	}
	return cfg
}

func requireStatusCode(t *testing.T, err error, code int) {
	t.Helper()

	statusErr, ok := errors.AsType[*apierrors.StatusError](err)
	require.True(t, ok, "expected a StatusError, got %v", err)
	require.Equal(t, code, int(statusErr.ErrStatus.Code))
}
