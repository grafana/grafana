package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestPermissionCacheKey(t *testing.T) {
	testcases := []struct {
		name         string
		signedInUser *user.SignedInUser
		expected     string
	}{
		{
			name: "should return correct key for user",
			signedInUser: &user.SignedInUser{
				OrgID:        1,
				UserID:       1,
				FallbackType: claims.TypeUser,
			},
			expected: "rbac-permissions-1-user-1",
		},
		{
			name: "should return correct key for api key",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				ApiKeyID:         1,
				IsServiceAccount: false,
				FallbackType:     claims.TypeUser,
			},
			expected: "rbac-permissions-1-api-key-1",
		},
		{
			name: "should return correct key for service account",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				UserID:           1,
				IsServiceAccount: true,
				FallbackType:     claims.TypeUser,
			},
			expected: "rbac-permissions-1-service-account-1",
		},
		{
			name: "should return correct key for matching a service account with userId -1",
			signedInUser: &user.SignedInUser{
				OrgID:            1,
				UserID:           -1,
				IsServiceAccount: true,
				FallbackType:     claims.TypeUser, // NOTE, this is still a service account!
			},
			expected: "rbac-permissions-1-service-account--1",
		},
		{
			name: "should use org role if no unique id",
			signedInUser: &user.SignedInUser{
				OrgID:        1,
				OrgRole:      org.RoleNone,
				FallbackType: claims.TypeUser,
			},
			expected: "rbac-permissions-1-user-None",
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, GetUserPermissionCacheKey(tc.signedInUser))
		})
	}
}

func TestGetSearchPermissionCacheKey(t *testing.T) {
	testcases := []struct {
		name          string
		signedInUser  *user.SignedInUser
		searchOptions SearchOptions
		expected      string
	}{
		{
			name: "should return correct key for user with no options",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{},
			expected:      "rbac-permissions-1-user-1",
		},
		{
			name: "should return correct key for user with action",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Action: "datasources:read",
			},
			expected: "rbac-permissions-1-user-1-datasources:read",
		},
		{
			name: "should return correct key for user with scope",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Scope: "datasources:*",
			},
			expected: "rbac-permissions-1-user-1-datasources:*",
		},
		{
			name: "should return correct key for user with action and scope",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Action: "datasources:read",
				Scope:  "datasources:*",
			},
			expected: "rbac-permissions-1-user-1-datasources:read-datasources:*",
		},
		{
			name: "should return correct key for user with role prefixes",
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				RolePrefixes: []string{"foo", "bar"},
			},
			expected: "rbac-permissions-1-user-1-foo-bar",
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, GetSearchPermissionCacheKey(tc.signedInUser, tc.searchOptions))
		})
	}
}
