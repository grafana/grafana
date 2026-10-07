package playlist

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var provider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		panic(err)
	}
	m.Run()
}

// mockAttributes implements authorizer.Attributes for testing
type mockAttributes struct {
	authorizer.Attributes
	isResourceRequest bool
	verb              string
}

func (m *mockAttributes) IsResourceRequest() bool { return m.isResourceRequest }
func (m *mockAttributes) GetVerb() string         { return m.verb }
func (m *mockAttributes) GetAPIGroup() string     { return "playlist.grafana.app" }
func (m *mockAttributes) GetResource() string     { return "playlists" }
func (m *mockAttributes) GetNamespace() string    { return "default" }
func (m *mockAttributes) GetName() string         { return "my-playlist" }

func installerWithToggle(t *testing.T, on bool, ac authlib.AccessClient) *AppInstaller {
	provider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagPlaylistsRBAC: setting.NewInMemoryFlag(featuremgmt.FlagPlaylistsRBAC, on),
	})
	return &AppInstaller{
		accessClient: ac,
		logger:       log.NewNopLogger(),
	}
}

// mockAccessClient implements authlib.AccessClient for testing
type mockAccessClient struct {
	authlib.AccessClient
	checkFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error)
}

func (m *mockAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	if m.checkFunc != nil {
		return m.checkFunc(ctx, info, req)
	}
	return authlib.CheckResponse{}, nil
}

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		verb             string
		isResourceReq    bool
		hasPermission    bool
		withoutUser      bool
		expectedDecision authorizer.Decision
		expectedReason   string
	}{
		{
			name:             "get with permission allows",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "get without permission denies",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "list with permission allows",
			verb:             "list",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "watch with permission allows",
			verb:             "watch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create with permission allows",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create without permission denies",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "update with permission allows",
			verb:             "update",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "patch with permission allows",
			verb:             "patch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "delete with permission allows",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "delete without permission denies",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "deletecollection with permission allows",
			verb:             "deletecollection",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		// Edge cases
		{
			name:             "non-resource request returns no opinion",
			verb:             "get",
			isResourceReq:    false,
			expectedDecision: authorizer.DecisionNoOpinion,
		},
		{
			name:             "unsupported verb denies",
			verb:             "unsupported",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "unsupported verb: unsupported",
		},
		{
			name:             "missing user denies",
			verb:             "get",
			isResourceReq:    true,
			withoutUser:      true,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "valid user is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var checked *authlib.CheckRequest
			mockAC := &mockAccessClient{
				checkFunc: func(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
					checked = &req
					return authlib.CheckResponse{Allowed: tt.hasPermission}, nil
				},
			}

			installer := installerWithToggle(t, true, mockAC)

			attrs := &mockAttributes{
				isResourceRequest: tt.isResourceReq,
				verb:              tt.verb,
			}

			ctx := context.Background()
			if !tt.withoutUser {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{
					OrgID:   1,
					UserID:  1,
					OrgRole: identity.RoleViewer,
				})
			}

			auth := installer.GetAuthorizer()
			decision, reason, err := auth.Authorize(ctx, attrs)

			if tt.withoutUser && tt.isResourceReq {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, tt.expectedDecision, decision)
			if tt.expectedReason != "" {
				assert.Contains(t, reason, tt.expectedReason)
			}
			if tt.isResourceReq && !tt.withoutUser && tt.verb != "unsupported" {
				require.NotNil(t, checked)
				assert.Equal(t, authlib.CheckRequest{
					Verb:      tt.verb,
					Group:     "playlist.grafana.app",
					Resource:  "playlists",
					Namespace: "default",
				}, *checked)
			} else {
				assert.Nil(t, checked)
			}
		})
	}
}

func TestGetAuthorizerToggleOff(t *testing.T) {
	mockAC := &mockAccessClient{}

	noneCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID:   1,
		UserID:  1,
		OrgRole: identity.RoleNone,
	})
	viewerCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID:   1,
		UserID:  2,
		OrgRole: identity.RoleViewer,
	})

	t.Run("non-resource request defers regardless of role", func(t *testing.T) {
		auth := installerWithToggle(t, false, mockAC).GetAuthorizer()
		attrs := &mockAttributes{isResourceRequest: false, verb: "get"}
		decision, _, err := auth.Authorize(noneCtx, attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("None role with read verb allows (hotfix)", func(t *testing.T) {
		auth := installerWithToggle(t, false, mockAC).GetAuthorizer()
		for _, verb := range []string{"get", "list", "watch"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(noneCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision, "verb: %s", verb)
		}
	})

	t.Run("None role with write verb defers to roleAuthorizer", func(t *testing.T) {
		auth := installerWithToggle(t, false, mockAC).GetAuthorizer()
		for _, verb := range []string{"create", "update", "delete"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(noneCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionNoOpinion, decision, "verb: %s", verb)
		}
	})

	t.Run("non-None role defers to roleAuthorizer", func(t *testing.T) {
		auth := installerWithToggle(t, false, mockAC).GetAuthorizer()
		for _, verb := range []string{"get", "list", "create"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(viewerCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionNoOpinion, decision, "verb: %s", verb)
		}
	})
}
