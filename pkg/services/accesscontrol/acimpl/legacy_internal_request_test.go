package acimpl

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
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
		profile   legacyclient.LegacyInternalIdentityProfile
		wantError bool
	}{
		{
			name:      "org namespace from wildcard",
			requester: service,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   legacyclient.LegacyInternalIdentityService,
		},
		{
			name:      "stack namespace from wildcard",
			requester: service,
			mapper: func(int64) string {
				return legacyInternalRequestTestStackNamespace
			},
			namespace: legacyInternalRequestTestStackNamespace,
			profile:   legacyclient.LegacyInternalIdentityService,
		},
		{
			name:      "explicit namespace wins over placeholder org",
			requester: namespaced,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   legacyclient.LegacyInternalIdentityService,
		},
		{
			name:      "provisioning identity",
			requester: provisioning,
			mapper:    types.OrgNamespaceFormatter,
			namespace: namespace,
			profile:   legacyclient.LegacyInternalIdentityProvisioning,
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
				require.Equal(t, legacyclient.LegacyCheckRequest{}, req)

				return
			}

			require.NoError(t, err)
			require.Equal(t, legacyclient.LegacyCheckRequest{
				Namespace:           tc.namespace,
				InternalIdentity:    &legacyclient.LegacyInternalIdentity{Profile: tc.profile},
				Evaluator:           accesscontrol.EvalPermission("dashboards:create", "folders:uid:target"),
				SkipScopeResolution: true,
			}, req)
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
	require.Equal(t, legacyclient.LegacyCheckRequest{
		Restriction: &legacyclient.LegacyActionRestriction{},
		Namespace:   types.OrgNamespaceFormatter(legacyInternalRequestTestOrgID),
		Subject:     types.NewTypeID(types.TypeAccessPolicy, identity.InternalIdentityService.String()),
		Evaluator:   accesscontrol.EvalPermission("dashboards:create"),
		Teams:       []string{},
	}, req)
}
