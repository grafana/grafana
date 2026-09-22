package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
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
	cfg            *provisioningv0alpha1.Repository
	refs           []provisioningv0alpha1.RefItem
	listRefsCalled bool
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
	r.listRefsCalled = true
	return r.refs, nil
}

func (r *fakeVersionedRepository) CompareFiles(context.Context, string, string) ([]repository.VersionedFileChange, error) {
	return nil, nil
}

var _ repository.Versioned = (*fakeVersionedRepository)(nil)
