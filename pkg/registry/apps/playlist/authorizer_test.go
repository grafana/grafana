package playlist

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

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
func (m *mockAttributes) GetName() string         { return "" }
func (m *mockAttributes) GetSubresource() string  { return "" }
func (m *mockAttributes) GetPath() string         { return "" }

// mockAccessClient implements authlib.AccessClient for testing
type mockAccessClient struct {
	allowed      bool
	lastCheckReq authlib.CheckRequest
}

func (m *mockAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	m.lastCheckReq = req
	return authlib.CheckResponse{Allowed: m.allowed}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func installerWithToggle(on bool, ac authlib.AccessClient) *AppInstaller {
	var features featuremgmt.FeatureToggles
	if on {
		features = featuremgmt.WithFeatures(featuremgmt.FlagPlaylistsRBAC)
	} else {
		features = featuremgmt.WithFeatures()
	}
	return &AppInstaller{
		features:     features,
		accessClient: ac,
		logger:       log.NewNopLogger(),
	}
}

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		verb             string
		isResourceReq    bool
		allowed          bool
		withoutUser      bool
		expectedDecision authorizer.Decision
	}{
		{
			name:             "get with permission allows",
			verb:             "get",
			isResourceReq:    true,
			allowed:          true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "get without permission denies",
			verb:             "get",
			isResourceReq:    true,
			allowed:          false,
			expectedDecision: authorizer.DecisionDeny,
		},
		{
			name:             "list with permission allows",
			verb:             "list",
			isResourceReq:    true,
			allowed:          true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create with permission allows",
			verb:             "create",
			isResourceReq:    true,
			allowed:          true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create without permission denies",
			verb:             "create",
			isResourceReq:    true,
			allowed:          false,
			expectedDecision: authorizer.DecisionDeny,
		},
		{
			name:             "delete with permission allows",
			verb:             "delete",
			isResourceReq:    true,
			allowed:          true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "non-resource request returns no opinion",
			verb:             "get",
			isResourceReq:    false,
			expectedDecision: authorizer.DecisionNoOpinion,
		},
		{
			name:             "missing identity denies",
			verb:             "get",
			isResourceReq:    true,
			withoutUser:      true,
			expectedDecision: authorizer.DecisionDeny,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockAccessClient{allowed: tt.allowed}
			installer := installerWithToggle(true, mockClient)

			attrs := &mockAttributes{
				isResourceRequest: tt.isResourceReq,
				verb:              tt.verb,
			}

			ctx := context.Background()
			if !tt.withoutUser {
				user := &identity.StaticRequester{
					OrgID:   1,
					UserID:  1,
					OrgRole: identity.RoleViewer,
				}
				ctx = identity.WithRequester(ctx, user)
				ctx = authlib.WithAuthInfo(ctx, user)
			}

			auth := installer.GetAuthorizer()
			decision, _, err := auth.Authorize(ctx, attrs)

			if tt.withoutUser && tt.isResourceReq {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, tt.expectedDecision, decision)

			// Verify the verb is passed through to the access client
			if tt.isResourceReq && !tt.withoutUser {
				assert.Equal(t, tt.verb, mockClient.lastCheckReq.Verb)
			}
		})
	}
}

func TestGetAuthorizerToggleOff(t *testing.T) {
	mockClient := &mockAccessClient{}
	installer := installerWithToggle(false, mockClient)
	auth := installer.GetAuthorizer()

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
		attrs := &mockAttributes{isResourceRequest: false, verb: "get"}
		decision, _, err := auth.Authorize(noneCtx, attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("None role with read verb allows (hotfix)", func(t *testing.T) {
		for _, verb := range []string{"get", "list", "watch"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(noneCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision, "verb: %s", verb)
		}
	})

	t.Run("None role with write verb defers to roleAuthorizer", func(t *testing.T) {
		for _, verb := range []string{"create", "update", "delete"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(noneCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionNoOpinion, decision, "verb: %s", verb)
		}
	})

	t.Run("non-None role defers to roleAuthorizer", func(t *testing.T) {
		for _, verb := range []string{"get", "list", "create"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(viewerCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionNoOpinion, decision, "verb: %s", verb)
		}
	})
}
