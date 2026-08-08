package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioningcontroller "github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
)

func TestTestConnector_RequiresNewTokenWhenURLChanges(t *testing.T) {
	oldRepo := &staticTestRepository{
		cfg: testGitHubRepository("test", "default", "https://github.com/grafana/old"),
	}
	oldRepo.cfg.Secure.Token = common.InlineSecureValue{Name: "old-token"}

	repoFactory := repository.NewMockFactory(t)
	connector := NewTestConnector(
		&testConnectorDeps{repo: oldRepo, repoFactory: repoFactory},
		repository.NewTester(),
	)

	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "test", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"Test Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body)).WithContext(ctx))

	require.Error(t, responder.err)
	status := responder.err.(apierrors.APIStatus).Status()
	assert.Equal(t, int32(http.StatusBadRequest), status.Code)
	assert.Contains(t, status.Message, "a new token is required when changing the repository URL")
}

func TestTestConnector_AllowsURLChangeWithNewToken(t *testing.T) {
	oldRepo := &staticTestRepository{
		cfg: testGitHubRepository("test", "default", "https://github.com/grafana/old"),
	}
	oldRepo.cfg.Secure.Token = common.InlineSecureValue{Name: "old-token"}

	tmpRepo := &staticTestRepository{
		cfg: testGitHubRepository("test", "default", "https://github.com/grafana/new"),
		rsp: &provisioningv0alpha1.TestResults{Success: true, Code: http.StatusOK},
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.URL() == "https://github.com/grafana/new" &&
			cfg.Secure.Token.Create == common.RawSecureValue("new-token")
	})).Return(tmpRepo, nil).Once()

	responder := &testResponder{}
	connector := NewTestConnector(
		&testConnectorDeps{repo: oldRepo, repoFactory: repoFactory},
		repository.NewTester(),
	)
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "test", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"Test Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}},"secure":{"token":{"create":"new-token"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
	assert.Equal(t, http.StatusOK, responder.statusCode)
	assert.True(t, tmpRepo.testCalled)
}

func TestTestConnector_AllowsUnchangedURLWithoutNewToken(t *testing.T) {
	oldRepo := &staticTestRepository{
		cfg: testGitHubRepository("test", "default", "https://github.com/grafana/repo"),
	}
	oldRepo.cfg.Secure.Token = common.InlineSecureValue{Name: "old-token"}

	tmpRepo := &staticTestRepository{
		cfg: testGitHubRepository("test", "default", "https://github.com/grafana/repo"),
		rsp: &provisioningv0alpha1.TestResults{Success: true, Code: http.StatusOK},
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.URL() == "https://github.com/grafana/repo" &&
			cfg.Secure.Token.Name == "old-token"
	})).Return(tmpRepo, nil).Once()

	responder := &testResponder{}
	connector := NewTestConnector(
		&testConnectorDeps{repo: oldRepo, repoFactory: repoFactory},
		repository.NewTester(),
	)
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "test", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"Updated Title","type":"github","github":{"url":"https://github.com/grafana/repo","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
	assert.Equal(t, http.StatusOK, responder.statusCode)
	assert.True(t, tmpRepo.testCalled)
}

type testResponder struct {
	statusCode int
	object     runtime.Object
	err        error
}

func (r *testResponder) Object(statusCode int, obj runtime.Object) {
	r.statusCode = statusCode
	r.object = obj
}

func (r *testResponder) Error(err error) {
	r.err = err
}

type testConnectorDeps struct {
	repo        repository.Repository
	repoFactory repository.Factory
}

func (d *testConnectorDeps) GetRepository(_ context.Context, _ string) (repository.Repository, error) {
	return d.repo, nil
}

func (d *testConnectorDeps) GetHealthyRepository(_ context.Context, _ string) (repository.Repository, error) {
	return d.repo, nil
}

func (d *testConnectorDeps) GetConnection(_ context.Context, _ string) (connection.Connection, error) {
	return nil, nil
}

func (d *testConnectorDeps) GetStatusPatcher() *appcontroller.RepositoryStatusPatcher {
	return nil
}

func (d *testConnectorDeps) GetHealthChecker() *provisioningcontroller.RepositoryHealthChecker {
	return nil
}

func (d *testConnectorDeps) GetRepoFactory() repository.Factory {
	return d.repoFactory
}

type staticTestRepository struct {
	cfg        *provisioningv0alpha1.Repository
	rsp        *provisioningv0alpha1.TestResults
	testCalled bool
}

func (r *staticTestRepository) ValidatePermissions(ctx context.Context) ([]repository.Permission, error) {
	return nil, nil
}

func (r *staticTestRepository) Config() *provisioningv0alpha1.Repository {
	return r.cfg
}

func (r *staticTestRepository) Test(context.Context) (*provisioningv0alpha1.TestResults, error) {
	r.testCalled = true
	return r.rsp, nil
}

func testGitHubRepository(name, namespace, url string) *provisioningv0alpha1.Repository {
	return &provisioningv0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:       name,
			Namespace:  namespace,
			Finalizers: []string{repository.CleanFinalizer},
		},
		Spec: provisioningv0alpha1.RepositorySpec{
			Title: "Test Repo",
			Type:  provisioningv0alpha1.GitHubRepositoryType,
			GitHub: &provisioningv0alpha1.GitHubRepositoryConfig{
				URL:    url,
				Branch: "main",
			},
		},
	}
}
