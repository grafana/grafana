package provisioning

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioningapi "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// versionedFakeRepo embeds MockRepository and adds a History method so the
// connector's `repo.(repository.Versioned)` assertion succeeds. We track
// whether History was called to assert backend invocation order.
type versionedFakeRepo struct {
	*repository.MockRepository
	historyCalled bool
}

func (v *versionedFakeRepo) History(_ context.Context, _, _ string) ([]provisioningapi.HistoryItem, error) {
	v.historyCalled = true
	return []provisioningapi.HistoryItem{}, nil
}

func (v *versionedFakeRepo) LatestRef(_ context.Context) (string, error) { return "", nil }
func (v *versionedFakeRepo) ListRefs(_ context.Context) ([]provisioningapi.RefItem, error) {
	return nil, nil
}
func (v *versionedFakeRepo) CompareFiles(_ context.Context, _, _ string) ([]repository.VersionedFileChange, error) {
	return nil, nil
}

func TestHistorySubresource_RefValidation(t *testing.T) {
	tests := []struct {
		name              string
		ref               string
		wantInvalidRefErr bool
		wantHistoryCalled bool
	}{
		{name: "empty ref forwarded", ref: "", wantHistoryCalled: true},
		{name: "valid branch", ref: "main", wantHistoryCalled: true},
		{name: "valid branch with slash", ref: "feature/my-branch", wantHistoryCalled: true},
		{name: "valid short SHA", ref: "abc1234", wantHistoryCalled: true},
		{name: "valid full SHA", ref: "abcdef0123456789abcdef0123456789abcdef01", wantHistoryCalled: true},
		{name: "invalid ref with semicolon", ref: "main; rm -rf /", wantInvalidRefErr: true},
		{name: "invalid ref with backtick", ref: "main`whoami`", wantInvalidRefErr: true},
		{name: "invalid ref with double dots", ref: "feature/..bad", wantInvalidRefErr: true},
		{name: "invalid ref with space", ref: "main branch", wantInvalidRefErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(&provisioningapi.Repository{}).Maybe()
			fakeRepo := &versionedFakeRepo{MockRepository: mockRepo}

			h := &historySubresource{repoGetter: &fakeRepoGetter{repo: fakeRepo}}
			responder := &fakeResponder{}

			handler, err := h.Connect(context.Background(), "test-repo", nil, responder)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodGet, "/test-repo/history/dashboard.json", nil)
			if tt.ref != "" {
				q := req.URL.Query()
				q.Set("ref", tt.ref)
				req.URL.RawQuery = q.Encode()
			}
			handler.ServeHTTP(httptest.NewRecorder(), req)

			if tt.wantInvalidRefErr {
				require.Error(t, responder.err)
				require.True(t, apierrors.IsBadRequest(responder.err), "expected BadRequest, got %v", responder.err)
				require.False(t, fakeRepo.historyCalled, "backend History must not be called for invalid ref")
			} else {
				require.NoError(t, responder.err)
				require.Equal(t, tt.wantHistoryCalled, fakeRepo.historyCalled)
			}
		})
	}
}
