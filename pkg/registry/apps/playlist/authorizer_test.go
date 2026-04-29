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
	apiGroup          string
	resource          string
	namespace         string
	name              string
	subresource       string
	path              string
}

func (m *mockAttributes) IsResourceRequest() bool { return m.isResourceRequest }
func (m *mockAttributes) GetVerb() string         { return m.verb }
func (m *mockAttributes) GetAPIGroup() string     { return m.apiGroup }
func (m *mockAttributes) GetResource() string     { return m.resource }
func (m *mockAttributes) GetNamespace() string    { return m.namespace }
func (m *mockAttributes) GetName() string         { return m.name }
func (m *mockAttributes) GetSubresource() string  { return m.subresource }
func (m *mockAttributes) GetPath() string         { return m.path }

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

type mockAccessClient struct {
	checkFunc func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error)
}

func (m *mockAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if m.checkFunc != nil {
		return m.checkFunc(ctx, id, req, folder)
	}
	return authlib.CheckResponse{Allowed: false}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		verb             string
		isResourceReq    bool
		hasPermission    bool
		checkError       bool
		withoutUser      bool
		emptyResourceRef bool
		expectedDecision authorizer.Decision
		expectedReason   string
	}{
		{
			name:             "get with read permission allows",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "get without read permission denies",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "list with read permission allows",
			verb:             "list",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "watch with read permission allows",
			verb:             "watch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create with write permission allows",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "create without write permission denies",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "update with write permission allows",
			verb:             "update",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "patch with write permission allows",
			verb:             "patch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "delete with write permission allows",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "delete without write permission denies",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "deletecollection with write permission allows",
			verb:             "deletecollection",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "permission evaluation error denies",
			verb:             "get",
			isResourceReq:    true,
			checkError:       true,
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "permission evaluation failed",
		},
		{
			name:             "empty group and resource use playlist defaults",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    true,
			emptyResourceRef: true,
			expectedDecision: authorizer.DecisionAllow,
		},
		{
			name:             "non-resource request returns no opinion",
			verb:             "get",
			isResourceReq:    false,
			expectedDecision: authorizer.DecisionNoOpinion,
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
			var checkedReq authlib.CheckRequest
			mockAC := &mockAccessClient{
				checkFunc: func(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
					checkedReq = req
					if tt.checkError {
						return authlib.CheckResponse{}, assert.AnError
					}
					return authlib.CheckResponse{Allowed: tt.hasPermission}, nil
				},
			}

			installer := installerWithToggle(true, mockAC)

			attrs := &mockAttributes{
				isResourceRequest: tt.isResourceReq,
				verb:              tt.verb,
				apiGroup:          "playlist.grafana.app",
				resource:          "playlists",
				namespace:         "default",
				name:              "playlist-1",
			}
			if tt.emptyResourceRef {
				attrs.apiGroup = ""
				attrs.resource = ""
			}

			ctx := context.Background()
			if !tt.withoutUser {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{
					OrgID:   1,
					UserID:  1,
					OrgRole: identity.RoleNone,
				})
			}

			auth := installer.GetAuthorizer()
			decision, reason, err := auth.Authorize(ctx, attrs)

			if (tt.withoutUser && tt.isResourceReq) || tt.checkError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			assert.Equal(t, tt.expectedDecision, decision)
			if tt.expectedReason != "" {
				assert.Contains(t, reason, tt.expectedReason)
			}
			if tt.isResourceReq && !tt.withoutUser {
				assert.Equal(t, tt.verb, checkedReq.Verb)
				expectedGroup := "playlist.grafana.app"
				expectedResource := "playlists"
				assert.Equal(t, expectedGroup, checkedReq.Group)
				assert.Equal(t, expectedResource, checkedReq.Resource)
				assert.Equal(t, "default", checkedReq.Namespace)
				assert.Equal(t, "playlist-1", checkedReq.Name)
				assert.Equal(t, "", checkedReq.Subresource)
			}
		})
	}
}

// TestGetAuthorizerNonNoneRoleFallback verifies that when AccessClient denies a user
// with a built-in org role (Viewer, Editor, Admin), the authorizer defers to the
// default role authorizer rather than denying outright.
func TestGetAuthorizerNonNoneRoleFallback(t *testing.T) {
	mockAC := &mockAccessClient{
		checkFunc: func(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{Allowed: false}, nil
		},
	}
	installer := installerWithToggle(true, mockAC)
	auth := installer.GetAuthorizer()

	for _, role := range []identity.RoleType{identity.RoleViewer, identity.RoleEditor, identity.RoleAdmin} {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID:   1,
			UserID:  1,
			OrgRole: role,
		})
		attrs := &mockAttributes{isResourceRequest: true, verb: "get", namespace: "default"}
		decision, _, err := auth.Authorize(ctx, attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionNoOpinion, decision, "role=%s should defer to role authorizer when AccessClient denies", role)
	}
}

func TestGetAuthorizerToggleOff(t *testing.T) {
	mockAC := &mockAccessClient{}
	installer := installerWithToggle(false, mockAC)
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

	t.Run("None role defers to roleAuthorizer", func(t *testing.T) {
		for _, verb := range []string{"get", "list", "watch"} {
			attrs := &mockAttributes{isResourceRequest: true, verb: verb}
			decision, _, err := auth.Authorize(noneCtx, attrs)
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionNoOpinion, decision, "verb: %s", verb)
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
