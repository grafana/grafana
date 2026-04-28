package playlist

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

func installerWithToggle(on bool, ac accesscontrol.AccessControl) *AppInstaller {
	var features featuremgmt.FeatureToggles
	if on {
		features = featuremgmt.WithFeatures(featuremgmt.FlagPlaylistsRBAC)
	} else {
		features = featuremgmt.WithFeatures()
	}
	return &AppInstaller{
		features:      features,
		accessControl: ac,
		logger:        log.NewNopLogger(),
	}
}

// mockAccessControl implements accesscontrol.AccessControl for testing
type mockAccessControl struct {
	accesscontrol.AccessControl
	evaluateFunc func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error)
}

func (m *mockAccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	if m.evaluateFunc != nil {
		return m.evaluateFunc(ctx, user, evaluator)
	}
	return false, nil
}

func (m *mockAccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
}

func (m *mockAccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return m
}

func (m *mockAccessControl) InvalidateResolverCache(orgID int64, scope string) {}

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		verb             string
		isResourceReq    bool
		hasPermission    bool
		withoutUser      bool
		expectedDecision authorizer.Decision
		expectedAction   string
		expectedReason   string
	}{
		// Read verbs → playlists:read
		{
			name:             "get with read permission allows",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsRead,
		},
		{
			name:             "get without read permission denies",
			verb:             "get",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedAction:   ActionPlaylistsRead,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "list with read permission allows",
			verb:             "list",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsRead,
		},
		{
			name:             "watch with read permission allows",
			verb:             "watch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsRead,
		},
		// Write verbs → playlists:write
		{
			name:             "create with write permission allows",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsWrite,
		},
		{
			name:             "create without write permission denies",
			verb:             "create",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedAction:   ActionPlaylistsWrite,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "update with write permission allows",
			verb:             "update",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsWrite,
		},
		{
			name:             "patch with write permission allows",
			verb:             "patch",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsWrite,
		},
		{
			name:             "delete with write permission allows",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsWrite,
		},
		{
			name:             "delete without write permission denies",
			verb:             "delete",
			isResourceReq:    true,
			hasPermission:    false,
			expectedDecision: authorizer.DecisionDeny,
			expectedAction:   ActionPlaylistsWrite,
			expectedReason:   "insufficient permissions",
		},
		{
			name:             "deletecollection with write permission allows",
			verb:             "deletecollection",
			isResourceReq:    true,
			hasPermission:    true,
			expectedDecision: authorizer.DecisionAllow,
			expectedAction:   ActionPlaylistsWrite,
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
			var evaluatedAction string
			mockAC := &mockAccessControl{
				evaluateFunc: func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
					evalStr := evaluator.String()
					if strings.Contains(evalStr, ActionPlaylistsRead) {
						evaluatedAction = ActionPlaylistsRead
					} else if strings.Contains(evalStr, ActionPlaylistsWrite) {
						evaluatedAction = ActionPlaylistsWrite
					}
					return tt.hasPermission, nil
				},
			}

			installer := installerWithToggle(true, mockAC)

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
			if tt.isResourceReq && !tt.withoutUser && tt.expectedAction != "" && tt.verb != "unsupported" {
				assert.Equal(t, tt.expectedAction, evaluatedAction)
			}
		})
	}
}

func TestGetAuthorizerToggleOff(t *testing.T) {
	mockAC := &mockAccessControl{}
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
