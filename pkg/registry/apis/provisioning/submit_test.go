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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type submittableRepository struct {
	*repository.MockConfigRepository
	*repository.MockPullRequestSubmitter
}

const validSubmission = `{"spec":{"ref":"feature","title":"Add dashboard","description":"Made in Grafana"}}`

func TestSubmitConnector(t *testing.T) {
	t.Run("opens the pull request and returns its number and URL", func(t *testing.T) {
		repo := newSubmittableRepository(t)
		repo.MockPullRequestSubmitter.EXPECT().
			SubmitPullRequest(mock.Anything, repository.NewPullRequest{
				Head:  "feature",
				Title: "Add dashboard",
				Body:  "Made in Grafana",
			}).
			Return(&repository.SubmittedPullRequest{Number: 42, URL: "https://github.com/grafana/grafana/pull/42"}, nil)
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").Return(repo, nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)
		res, ok := responder.obj.(*provisioning.PullRequestSubmission)
		require.True(t, ok)
		require.Equal(t, provisioning.PullRequestSubmissionStatus{Number: 42, URL: "https://github.com/grafana/grafana/pull/42"}, res.Status)
	})

	t.Run("rejects non-POST methods", func(t *testing.T) {
		responder := serveSubmit(t, NewMockSubmitAccess(t), http.MethodGet, "")

		require.True(t, apierrors.IsMethodNotSupported(responder.err))
	})

	for name, body := range map[string]string{
		"missing ref":   `{"spec":{"title":"t"}}`,
		"missing title": `{"spec":{"ref":"feature"}}`,
		"unknown field": `{"spec":{"ref":"feature","title":"t","bogus":true}}`,
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			responder := serveSubmit(t, NewMockSubmitAccess(t), http.MethodPost, body)

			require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
		})
	}

	t.Run("rejects a ref that is the repository branch", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").Return(newSubmittableRepository(t), nil)

		responder := serveSubmit(t, access, http.MethodPost, `{"spec":{"ref":"main","title":"t"}}`)

		require.True(t, apierrors.IsBadRequest(responder.err), "got %v", responder.err)
	})

	t.Run("returns the error when the repository cannot be found", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").
			Return(nil, apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), "test-repo"))

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		require.True(t, apierrors.IsNotFound(responder.err))
	})

	t.Run("returns the error when the repository is not healthy", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").
			Return(nil, &apierrors.StatusError{ErrStatus: metav1.Status{Code: http.StatusFailedDependency}})

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		requireStatusCode(t, responder.err, http.StatusFailedDependency)
	})

	t.Run("returns NotImplemented for repositories that cannot submit pull requests", func(t *testing.T) {
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").Return(repository.NewMockConfigRepository(t), nil)

		responder := serveSubmit(t, access, http.MethodPost, validSubmission)

		requireStatusCode(t, responder.err, http.StatusNotImplemented)
	})

	t.Run("returns the provider's status when the pull request is rejected", func(t *testing.T) {
		repo := newSubmittableRepository(t)
		repo.MockPullRequestSubmitter.EXPECT().
			SubmitPullRequest(mock.Anything, mock.Anything).
			Return(nil, repository.ErrPermissionDenied)
		access := NewMockSubmitAccess(t)
		access.EXPECT().GetHealthyRepository(mock.Anything, "test-repo").Return(repo, nil)

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

func newSubmittableRepository(t *testing.T) *submittableRepository {
	repo := &submittableRepository{
		MockConfigRepository:     repository.NewMockConfigRepository(t),
		MockPullRequestSubmitter: repository.NewMockPullRequestSubmitter(t),
	}
	repo.MockConfigRepository.EXPECT().Config().Return(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/grafana",
				Branch: "main",
			},
		},
	}).Maybe()
	return repo
}

func requireStatusCode(t *testing.T, err error, code int) {
	t.Helper()

	statusErr, ok := errors.AsType[*apierrors.StatusError](err)
	require.True(t, ok, "expected a StatusError, got %v", err)
	require.Equal(t, code, int(statusErr.ErrStatus.Code))
}
