package acimpl

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	legacyInternalRequestTestOrgID          int64 = 12
	legacyInternalRequestTestStackNamespace       = "stacks-123"
)

func TestBuildLegacyCheckInternalIdentity(t *testing.T) {
	namespace := types.OrgNamespaceFormatter(legacyInternalRequestTestOrgID)
	_, service := identity.WithServiceIdentity(t.Context(), legacyInternalRequestTestOrgID)
	_, namespaced := identity.WithServiceIdentityForSingleNamespace(t.Context(), namespace)
	_, provisioning, err := identity.WithProvisioningIdentity(t.Context(), namespace)
	require.NoError(t, err)

	_, instance := identity.WithServiceIdentity(t.Context(), accesscontrol.GlobalOrgID)

	tests := []struct {
		name      string
		requester identity.Requester
		mapper    types.NamespaceFormatter
		namespace string
		profile   identity.InternalIdentityProfile
		wantError bool
	}{
		{
			name:      "org namespace from wildcard",
			requester: service,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   identity.InternalIdentityService,
		},
		{
			name:      "stack namespace from wildcard",
			requester: service,
			mapper: func(int64) string {
				return legacyInternalRequestTestStackNamespace
			},
			namespace: legacyInternalRequestTestStackNamespace,
			profile:   identity.InternalIdentityService,
		},
		{
			name:      "explicit namespace wins over placeholder org",
			requester: namespaced,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   identity.InternalIdentityService,
		},
		{
			name:      "provisioning identity",
			requester: provisioning,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   identity.InternalIdentityProvisioning,
		},
		{
			name:      "missing target for instance identity",
			requester: instance,
			mapper:    types.OrgNamespaceFormatter,
			wantError: true,
		},
		{
			name:      "missing namespace mapper",
			requester: service,
			wantError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := ProvideAccessControlTest().WithoutResolvers().(*AccessControl)
			evaluator := accesscontrol.EvalPermission("dashboards:create", "folders:uid:target")

			req, err := ac.buildLegacyCheckRequest(tc.requester, evaluator, false, tc.mapper)
			if tc.wantError {
				require.Error(t, err)
				require.Empty(t, req)

				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.namespace, req.Namespace)
			require.Equal(t, tc.profile.String(), req.InternalIdentity.Profile)
			require.Empty(t, req.Subject)
			require.Nil(t, req.GlobalEvaluation)
			require.True(t, req.SkipScopeResolution)
			require.Equal(t, accesscontrol.EvalPermission("dashboards:create", "folders:uid:target"), req.Evaluator)
		})
	}
}

func TestBuildLegacyCheckDoesNotInferInternalIdentity(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:      types.TypeAccessPolicy,
		UserUID:   identity.InternalIdentityService.String(),
		OrgID:     legacyInternalRequestTestOrgID,
		Namespace: types.OrgNamespaceFormatter(legacyInternalRequestTestOrgID),
	}

	req, err := ProvideAccessControlTest().buildLegacyCheckRequest(requester, accesscontrol.EvalPermission("dashboards:create"), false, types.OrgNamespaceFormatter)
	require.NoError(t, err)
	require.Nil(t, req.InternalIdentity)
	require.Equal(t, types.NewTypeID(types.TypeAccessPolicy, identity.InternalIdentityService.String()), req.Subject)
}
