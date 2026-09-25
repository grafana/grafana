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
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestFiletreeConnector_ListsFilesForEphemeralRepository(t *testing.T) {
	tmpRepo := &fakeReaderRepository{
		cfg: testGitHubRepository("new", "default", "https://github.com/grafana/new"),
		entries: []repository.FileTreeEntry{
			{Path: "dashboards", Blob: false},
			{Path: "dashboards/foo.json", Blob: true, Size: 10, Hash: "abc"},
			{Path: "README.md", Blob: true, Size: 5, Hash: "def"},
		},
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.URL() == "https://github.com/grafana/new" && cfg.GetName() == "hack-on-hack-for-new"
	})).Return(tmpRepo, nil).Once()

	connector := NewFiletreeConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/filetree", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
	fileList, ok := responder.object.(*provisioningv0alpha1.FileList)
	require.True(t, ok)
	// The subtree entry (dashboards, Blob: false) is excluded - only blobs are files.
	assert.Equal(t, []provisioningv0alpha1.FileItem{
		{Path: "dashboards/foo.json", Size: 10, Hash: "abc"},
		{Path: "README.md", Size: 5, Hash: "def"},
	}, fileList.Items)
}

func TestFiletreeConnector_RejectsRepositoryWithoutReadSupport(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg: testGitHubRepository("new", "default", "https://github.com/grafana/new"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(tmpRepo, nil).Once()

	connector := NewFiletreeConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/filetree", strings.NewReader(body)).WithContext(ctx))

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "does not support reading files")
}

func TestReftreeConnector_ListsRefsForEphemeralRepository(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg:  testGitHubRepository("new", "default", "https://github.com/grafana/new"),
		refs: []provisioningv0alpha1.RefItem{{Name: "main"}, {Name: "develop"}},
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.URL() == "https://github.com/grafana/new" && cfg.GetName() == "hack-on-hack-for-new"
	})).Return(tmpRepo, nil).Once()

	connector := NewReftreeConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reftree", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
	refList, ok := responder.object.(*provisioningv0alpha1.RefList)
	require.True(t, ok)
	assert.Equal(t, []provisioningv0alpha1.RefItem{{Name: "main"}, {Name: "develop"}}, refList.Items)
}

func TestReftreeConnector_RejectsRepositoryWithoutVersionedSupport(t *testing.T) {
	tmpRepo := &fakeReaderRepository{
		cfg: testGitHubRepository("new", "default", "https://github.com/grafana/new"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(tmpRepo, nil).Once()

	connector := NewReftreeConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reftree", strings.NewReader(body)).WithContext(ctx))

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "does not support versioned operations")
}

func TestBuildEphemeralRepository_UsesLiteralNameWhenNotThePlaceholder(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg: testGitHubRepository("draft-repo", "default", "https://github.com/grafana/new"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.MatchedBy(func(cfg *provisioningv0alpha1.Repository) bool {
		return cfg.GetName() == "draft-repo"
	})).Return(tmpRepo, nil).Once()

	connector := NewReftreeConnector(&testConnectorDeps{repoFactory: repoFactory})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "draft-repo", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"Draft","type":"github","github":{"url":"https://github.com/grafana/new","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reftree", strings.NewReader(body)).WithContext(ctx))

	require.NoError(t, responder.err)
}

func TestFiletreeConnector_RejectsRepositoryFailingValidation(t *testing.T) {
	tmpRepo := &fakeReaderRepository{
		cfg: testGitHubRepository("hack-on-hack-for-new", "default", "http://169.254.169.254/latest/meta-data/"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(tmpRepo, nil).Once()

	// Simulates RepositoryValidator.validatePrivateEndpoint rejecting a URL that
	// resolves to a private/internal address - the SSRF guard real create/update
	// (and /test) apply, which this connector must not bypass.
	rejecting := rejectingValidator{message: "repository URL host must resolve to a public or allowed address"}

	connector := NewFiletreeConnector(&testConnectorDeps{repoFactory: repoFactory, repoValidator: rejecting})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"http://169.254.169.254/latest/meta-data/","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/filetree", strings.NewReader(body)).WithContext(ctx))

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "must resolve to a public or allowed address")
	assert.False(t, tmpRepo.readTreeCalled, "ReadTree must not be called when validation fails")
}

func TestReftreeConnector_RejectsRepositoryFailingValidation(t *testing.T) {
	tmpRepo := &fakeVersionedRepository{
		cfg: testGitHubRepository("hack-on-hack-for-new", "default", "http://169.254.169.254/latest/meta-data/"),
	}

	repoFactory := repository.NewMockFactory(t)
	repoFactory.EXPECT().Build(mock.Anything, mock.Anything).Return(tmpRepo, nil).Once()

	rejecting := rejectingValidator{message: "repository URL host must resolve to a public or allowed address"}

	connector := NewReftreeConnector(&testConnectorDeps{repoFactory: repoFactory, repoValidator: rejecting})
	responder := &testResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	handler, err := connector.Connect(ctx, "new", nil, responder)
	require.NoError(t, err)

	body := `{"spec":{"title":"New Repo","type":"github","github":{"url":"http://169.254.169.254/latest/meta-data/","branch":"main"}}}`
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reftree", strings.NewReader(body)).WithContext(ctx))

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "must resolve to a public or allowed address")
	assert.False(t, tmpRepo.listRefsCalled, "ListRefs must not be called when validation fails")
}

// rejectingValidator is a repository.Validator that always fails with the given message -
// used to prove the ephemeral connectors run validation before touching the network.
type rejectingValidator struct {
	message string
}

func (r rejectingValidator) Validate(context.Context, *provisioningv0alpha1.Repository) field.ErrorList {
	return field.ErrorList{field.Invalid(field.NewPath("spec", "github", "url"), nil, r.message)}
}

// fakeReaderRepository is a minimal repository.Repository + repository.Reader fake.
type fakeReaderRepository struct {
	cfg            *provisioningv0alpha1.Repository
	entries        []repository.FileTreeEntry
	readTreeCalled bool
}

func (r *fakeReaderRepository) Config() *provisioningv0alpha1.Repository {
	return r.cfg
}

func (r *fakeReaderRepository) Test(context.Context) (*provisioningv0alpha1.TestResults, error) {
	return &provisioningv0alpha1.TestResults{Success: true, Code: http.StatusOK}, nil
}

func (r *fakeReaderRepository) Read(context.Context, string, string) (*repository.FileInfo, error) {
	return nil, nil
}

func (r *fakeReaderRepository) ReadTree(context.Context, string) ([]repository.FileTreeEntry, error) {
	r.readTreeCalled = true
	return r.entries, nil
}

var _ repository.Reader = (*fakeReaderRepository)(nil)
