package authorizer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestNewCoreRoleAuthorizer(t *testing.T) {
	mockClient := &mockAccessClient{}
	auth := NewCoreRoleAuthorizer(mockClient)

	require.NotNil(t, auth)
	assert.Equal(t, mockClient, auth.c)
}

func TestCoreRoleAuthorizer_Authorize(t *testing.T) {
	t.Run("wrong resource returns deny with error", func(t *testing.T) {
		mockClient := &mockAccessClient{}
		auth := NewCoreRoleAuthorizer(mockClient)

		attrs := &fakeCoreAttributes{
			resource: "playlists",
		}

		decision, reason, err := auth.Authorize(context.Background(), attrs)

		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Empty(t, reason)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unauthorized request: resource playlists is not allowed")
	})

	t.Run("missing identity returns deny with error", func(t *testing.T) {
		mockClient := &mockAccessClient{}
		auth := NewCoreRoleAuthorizer(mockClient)

		attrs := &fakeCoreAttributes{
			resource: iamv0.CoreRoleInfo.GetName(),
		}

		decision, reason, err := auth.Authorize(context.Background(), attrs)

		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Empty(t, reason)
		assert.Error(t, err)
		assert.Equal(t, "unauthorized request: no identity found for request", err.Error())
	})

	t.Run("non-access-policy identity with write verbs returns deny", func(t *testing.T) {
		testCases := []struct {
			name         string
			identityType claims.IdentityType
			verb         string
		}{
			{
				name:         "user with create",
				identityType: claims.TypeUser,
				verb:         utils.VerbCreate,
			},
			{
				name:         "service account with update",
				identityType: claims.TypeServiceAccount,
				verb:         utils.VerbUpdate,
			},
			{
				name:         "api key with delete",
				identityType: claims.TypeAPIKey,
				verb:         utils.VerbDelete,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				mockClient := &mockAccessClient{}
				auth := NewCoreRoleAuthorizer(mockClient)

				authInfo := &mockAuthInfo{
					identityType: tc.identityType,
				}
				ctx := claims.WithAuthInfo(context.Background(), authInfo)

				attrs := &fakeCoreAttributes{
					resource: iamv0.CoreRoleInfo.GetName(),
					verb:     tc.verb,
				}

				decision, reason, err := auth.Authorize(ctx, attrs)

				assert.Equal(t, authorizer.DecisionDeny, decision)
				assert.Contains(t, reason, "unauthorized request: identity type")
				assert.Contains(t, reason, string(tc.identityType))
				assert.Contains(t, reason, tc.verb)
				assert.NoError(t, err)
			})
		}
	})

	t.Run("non-access-policy identity with read verbs calls Check", func(t *testing.T) {
		testCases := []struct {
			name         string
			identityType claims.IdentityType
			verb         string
		}{
			{
				name:         "user with get",
				identityType: claims.TypeUser,
				verb:         utils.VerbGet,
			},
			{
				name:         "user with list",
				identityType: claims.TypeUser,
				verb:         utils.VerbList,
			},
			{
				name:         "service account with watch",
				identityType: claims.TypeServiceAccount,
				verb:         utils.VerbWatch,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				mockClient := &mockAccessClient{
					checkResponse: claims.CheckResponse{Allowed: true},
				}
				auth := NewCoreRoleAuthorizer(mockClient)

				authInfo := &mockAuthInfo{
					identityType: tc.identityType,
				}
				ctx := claims.WithAuthInfo(context.Background(), authInfo)

				attrs := &fakeCoreAttributes{
					verb:        tc.verb,
					apiGroup:    iamv0.GROUP,
					resource:    iamv0.CoreRoleInfo.GetName(),
					namespace:   "default",
					name:        "my-corerole",
					subresource: "status",
					path:        "/apis/iam.grafana.app/v0alpha1/namespaces/default/coreroles/my-corerole/status",
				}

				decision, reason, err := auth.Authorize(ctx, attrs)

				assert.Equal(t, authorizer.DecisionAllow, decision)
				assert.Empty(t, reason)
				assert.NoError(t, err)
				require.NotNil(t, mockClient.lastCheckRequest)
				assert.Equal(t, tc.verb, mockClient.lastCheckRequest.Verb)
				assert.Equal(t, iamv0.GROUP, mockClient.lastCheckRequest.Group)
				assert.Equal(t, iamv0.CoreRoleInfo.GetName(), mockClient.lastCheckRequest.Resource)
				assert.Equal(t, "default", mockClient.lastCheckRequest.Namespace)
				assert.Equal(t, "my-corerole", mockClient.lastCheckRequest.Name)
				assert.Equal(t, "status", mockClient.lastCheckRequest.Subresource)
				assert.Equal(t, "/apis/iam.grafana.app/v0alpha1/namespaces/default/coreroles/my-corerole/status", mockClient.lastCheckRequest.Path)
			})
		}
	})

	t.Run("access-policy identity with any verb calls Check", func(t *testing.T) {
		testCases := []struct {
			name string
			verb string
		}{
			{
				name: "create",
				verb: utils.VerbCreate,
			},
			{
				name: "update",
				verb: utils.VerbUpdate,
			},
			{
				name: "delete",
				verb: utils.VerbDelete,
			},
			{
				name: "get",
				verb: utils.VerbGet,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				mockClient := &mockAccessClient{
					checkResponse: claims.CheckResponse{Allowed: true},
				}
				auth := NewCoreRoleAuthorizer(mockClient)

				authInfo := &mockAuthInfo{
					identityType: claims.TypeAccessPolicy,
				}
				ctx := claims.WithAuthInfo(context.Background(), authInfo)

				attrs := &fakeCoreAttributes{
					verb:     tc.verb,
					apiGroup: iamv0.GROUP,
					resource: iamv0.CoreRoleInfo.GetName(),
				}

				decision, reason, err := auth.Authorize(ctx, attrs)

				assert.Equal(t, authorizer.DecisionAllow, decision)
				assert.Empty(t, reason)
				assert.NoError(t, err)
				require.NotNil(t, mockClient.lastCheckRequest)
				assert.Equal(t, tc.verb, mockClient.lastCheckRequest.Verb)
			})
		}
	})

	t.Run("Check returns error", func(t *testing.T) {
		expectedErr := errors.New("check failed")
		mockClient := &mockAccessClient{
			checkError: expectedErr,
		}
		auth := NewCoreRoleAuthorizer(mockClient)

		authInfo := &mockAuthInfo{
			identityType: claims.TypeAccessPolicy,
		}
		ctx := claims.WithAuthInfo(context.Background(), authInfo)

		attrs := &fakeCoreAttributes{
			resource: iamv0.CoreRoleInfo.GetName(),
			verb:     utils.VerbGet,
		}

		decision, reason, err := auth.Authorize(ctx, attrs)

		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Empty(t, reason)
		assert.Error(t, err)
		assert.Equal(t, expectedErr, err)
	})

	t.Run("Check returns not allowed", func(t *testing.T) {
		mockClient := &mockAccessClient{
			checkResponse: claims.CheckResponse{Allowed: false},
		}
		auth := NewCoreRoleAuthorizer(mockClient)

		authInfo := &mockAuthInfo{
			identityType: claims.TypeAccessPolicy,
		}
		ctx := claims.WithAuthInfo(context.Background(), authInfo)

		attrs := &fakeCoreAttributes{
			resource: iamv0.CoreRoleInfo.GetName(),
			verb:     utils.VerbGet,
		}

		decision, reason, err := auth.Authorize(ctx, attrs)

		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Equal(t, "unauthorized request", reason)
		assert.NoError(t, err)
	})
}

// mockAccessClient is a mock implementation of claims.AccessClient
type mockAccessClient struct {
	checkResponse    claims.CheckResponse
	checkError       error
	lastCheckRequest *claims.CheckRequest
}

func (m *mockAccessClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	m.lastCheckRequest = &req
	if m.checkError != nil {
		return claims.CheckResponse{}, m.checkError
	}
	return m.checkResponse, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return nil, nil, nil
}

// mockAuthInfo is a mock implementation of claims.AuthInfo
type mockAuthInfo struct {
	identityType claims.IdentityType
	namespace    string
	uid          string
	name         string
}

func (m *mockAuthInfo) GetUID() string {
	if m.uid != "" {
		return m.uid
	}
	return "test-uid"
}

func (m *mockAuthInfo) GetIdentifier() string {
	return "test-identifier"
}

func (m *mockAuthInfo) GetIdentityType() claims.IdentityType {
	return m.identityType
}

func (m *mockAuthInfo) GetNamespace() string {
	if m.namespace != "" {
		return m.namespace
	}
	return "default"
}

func (m *mockAuthInfo) GetGroups() []string {
	return nil
}

func (m *mockAuthInfo) GetExtra() map[string][]string {
	return nil
}

func (m *mockAuthInfo) GetSubject() string {
	return "test-subject"
}

func (m *mockAuthInfo) GetAudience() []string {
	return nil
}

func (m *mockAuthInfo) GetTokenPermissions() []string {
	return nil
}

func (m *mockAuthInfo) GetTokenDelegatedPermissions() []string {
	return nil
}

func (m *mockAuthInfo) GetName() string {
	if m.name != "" {
		return m.name
	}
	return "test-name"
}

func (m *mockAuthInfo) GetEmail() string {
	return ""
}

func (m *mockAuthInfo) GetEmailVerified() bool {
	return false
}

func (m *mockAuthInfo) GetUsername() string {
	return ""
}

func (m *mockAuthInfo) GetAuthenticatedBy() string {
	return ""
}

func (m *mockAuthInfo) GetIDToken() string {
	return ""
}

// fakeCoreAttributes is a mock implementation of authorizer.Attributes
type fakeCoreAttributes struct {
	authorizer.Attributes
	verb        string
	apiGroup    string
	resource    string
	namespace   string
	name        string
	subresource string
	path        string
}

func (a *fakeCoreAttributes) GetVerb() string {
	return a.verb
}

func (a *fakeCoreAttributes) GetAPIGroup() string {
	return a.apiGroup
}

func (a *fakeCoreAttributes) GetResource() string {
	return a.resource
}

func (a *fakeCoreAttributes) GetNamespace() string {
	return a.namespace
}

func (a *fakeCoreAttributes) GetName() string {
	return a.name
}

func (a *fakeCoreAttributes) GetSubresource() string {
	return a.subresource
}

func (a *fakeCoreAttributes) GetPath() string {
	return a.path
}
