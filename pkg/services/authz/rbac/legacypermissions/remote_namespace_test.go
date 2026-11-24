package legacypermissions

import (
	"context"
	"testing"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
)

func TestRemoteRequesterNamespaces(t *testing.T) {
	for _, tc := range []struct {
		name, tenant, original string
		global, noOrg, allowed bool
	}{
		{"global sentinel", "default", "org-0", true, false, true},
		{"no membership sentinel", "default", "org--1", false, true, true},
		{"ordinary", "default", "default", false, false, true},
		{"empty", "default", "", false, false, true},
		{"missing flag", "default", "org-0", false, false, false},
		{"wrong flag", "default", "org--1", true, false, false},
		{"both flags", "default", "org-0", true, true, false},
		{"other tenant", "default", "org-2", false, false, false},
		{"stack global sentinel", "stacks-1", "org-0", true, false, false},
		{"stack no membership sentinel", "stacks-1", "org--1", false, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: tc.tenant, Permissions: []string{"authz.grafana.app/userpermissions:get"}}}))
			req := &authzv1.LegacyGetUserPermissionsRequest{Namespace: tc.tenant, GlobalOrg: tc.global, NoOrgMembership: tc.noOrg, Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", RequesterNamespace: &tc.original}}
			ns, err := authorizeRemoteRequest(ctx, req)
			if tc.allowed {
				require.NoError(t, err)
				require.Equal(t, tc.tenant, ns.Value)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestRemoteCacheKeyIncludesResolutionNamespace(t *testing.T) {
	original := "org-0"
	id := &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", RequesterNamespace: &original}
	sentinel := remoteIdentityCacheKey(id, "default", 0)
	original = "default"
	require.NotEqual(t, sentinel, remoteIdentityCacheKey(id, "default", 0))
}
