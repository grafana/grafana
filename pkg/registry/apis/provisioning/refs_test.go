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
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestRefsConnector_GetListsRefsForExistingRepository(t *testing.T) {
	repo := &fakeVersionedRepository{
		cfg:  testGitHubRepository("existing", "default", "https://github.com/grafana/repo"),
		refs: []provisioningv0alpha1.RefItem{{Name: "main"}},
	}

	connector := NewRefsConnector(&testConnectorDeps{repo: repo})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "existing", nil, responder)
	require.NoError(t, err)

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/refs", nil).WithContext(ctx))

	require.NoError(t, responder.err)
	refList, ok := responder.object.(*provisioningv0alpha1.RefList)
	require.True(t, ok)
	assert.Equal(t, []provisioningv0alpha1.RefItem{{Name: "main"}}, refList.Items)
}

func TestRefsConnector_PostListsRefsForEphemeralRepository(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg:  testGitHubRepository("new", "default", "https://github.com/grafana/new"),
		refs: []provisioningv0alpha1.RefItem{{Name: "main"}, {Name: "develop"}},
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.URL() == "https://github.com/grafana/new" && cfg.GetName() == "hack-on-hack-for-new"
	})).Return(tmpRepo, nil).Once()

	connector := NewRefsConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/refs", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
	refList, ok := responder.object.(*provisioningv0alpha1.RefList)
	require.True(t, ok)
	assert.Equal(t, []provisioningv0alpha1.RefItem{{Name: "main"}, {Name: "develop"}}, refList.Items)
}

func TestRefsConnector_PostUsesLiteralNameWhenNotThePlaceholder(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg: testGitHubRepository("draft-repo", "default", "https://github.com/grafana/new"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.GetName() == "draft-repo"
	})).Return(tmpRepo, nil).Once()

	connector := NewRefsConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "draft-repo", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"Draft","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/refs", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
}

func TestRefsConnector_RejectsUnsupportedMethod(t *testing.T) {
	connector := NewRefsConnector(&testConnectorDeps{})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "existing", nil, responder)
	require.NoError(t, err)

	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodDelete, "/refs", nil).WithContext(ctx))

	require.Error(t, responder.err)
	status := responder.err.(apierrors.APIStatus).Status()
	assert.Equal(t, int32(http.StatusMethodNotAllowed), status.Code)
}

// fakeVersionedRepository is a minimal repository.Repository + repository.Versioned fake,
// mirroring staticTestRepository's role for the /test connector tests.
type fakeVersionedRepository struct {
	cfg  *provisioningv0alpha1.Repository
	refs []provisioningv0alpha1.RefItem
}

func (r *fakeVersionedRepository) Config() *provisioningv0alpha1.Repository {
	return r.cfg
}

func (r *fakeVersionedRepository) Test(context.Context) (*provisioningv0alpha1.TestResults, error) {
	return &provisioningv0alpha1.TestResults{Success: true, Code: http.StatusOK}, nil
}

func (r *fakeVersionedRepository) History(context.Context, string, string) ([]provisioningv0alpha1.HistoryItem, error) {
	return nil, nil
}

func (r *fakeVersionedRepository) LatestRef(context.Context) (string, error) {
	return "", nil
}

func (r *fakeVersionedRepository) ListRefs(context.Context) ([]provisioningv0alpha1.RefItem, error) {
	return r.refs, nil
}

func (r *fakeVersionedRepository) CompareFiles(context.Context, string, string) ([]repository.VersionedFileChange, error) {
	return nil, nil
}

var _ repository.Versioned = (*fakeVersionedRepository)(nil)
