package identity_test

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const internalProfileTestOrgID int64 = 12

func TestInternalIdentityProfile(t *testing.T) {
	tests := []struct {
		name            string
		newRequester    func(t *testing.T) identity.Requester
		expectedProfile identity.InternalIdentityProfile
	}{
		{
			name: "service",
			newRequester: func(t *testing.T) identity.Requester {
				_, requester := identity.WithServiceIdentity(t.Context(), internalProfileTestOrgID)

				return requester
			},
			expectedProfile: identity.InternalIdentityService,
		},
		{
			name: "provisioning",
			newRequester: func(t *testing.T) identity.Requester {
				t.Helper()

				namespace := types.OrgNamespaceFormatter(internalProfileTestOrgID)
				_, requester, err := identity.WithProvisioningIdentity(t.Context(), namespace)
				require.NoError(t, err)

				return requester
			},
			expectedProfile: identity.InternalIdentityProvisioning,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			requester := tc.newRequester(t)

			profile, ok := identity.InternalIdentityProfileFor(requester)
			require.True(t, ok)
			require.Equal(t, tc.expectedProfile, profile)
			require.Equal(t, requester.GetIdentifier(), profile.String())

			grants, ok := identity.InternalIdentityPermissions(profile)
			require.True(t, ok)
			require.Equal(t, requester.GetPermissions(), grants)

			grants["dashboards:create"][0] = "folders:uid:one"
			delete(grants, "folders:read")

			require.Equal(t, []string{"*"}, requester.GetPermissions()["dashboards:create"])
			require.Contains(t, requester.GetPermissions(), "folders:read")
		})
	}
}

func TestInternalIdentityProfileModifiedGrants(t *testing.T) {
	_, service := identity.WithServiceIdentity(t.Context(), internalProfileTestOrgID)
	service.GetPermissions()["dashboards:create"][0] = "folders:uid:one"

	_, ok := identity.InternalIdentityProfileFor(service)
	require.False(t, ok, "profile loading must not undo requester restrictions")

	_, fresh := identity.WithServiceIdentity(t.Context(), internalProfileTestOrgID)
	require.Equal(t, []string{"*"}, fresh.GetPermissions()["dashboards:create"])
}

func TestInternalIdentityProfileUntrustedRequester(t *testing.T) {
	_, service := identity.WithServiceIdentity(t.Context(), internalProfileTestOrgID)

	tests := []struct {
		name      string
		requester identity.Requester
	}{
		{
			name: "nil requester",
		},
		{
			name:      "typed nil requester",
			requester: (*identity.StaticRequester)(nil),
		},
		{
			name: "manually constructed requester with matching UID and grants",
			requester: &identity.StaticRequester{
				Type:           types.TypeAccessPolicy,
				UserUID:        identity.InternalIdentityService.String(),
				OrgID:          internalProfileTestOrgID,
				OrgRole:        identity.RoleAdmin,
				IsGrafanaAdmin: true,
				Permissions: map[int64]map[string][]string{
					internalProfileTestOrgID: service.GetPermissions(),
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, ok := identity.InternalIdentityProfileFor(tc.requester)
			require.False(t, ok, "a matching UID and grants do not establish an internal identity")
		})
	}
}

func TestInternalIdentityProfileUnknown(t *testing.T) {
	_, ok := identity.InternalIdentityPermissions("unknown")
	require.False(t, ok)
}
