package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	apirequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLegacyCheckRequesterOrgID(t *testing.T) {
	const orgID int64 = 12
	for _, tc := range []struct {
		name            string
		namespace       string
		orgID           *int64
		globalStore     bool
		internal        bool
		omitRestriction bool
		wantError       string
	}{
		{name: "missing requester org", wantError: "legacy check requires requester org ID"},
		{name: "organization request", orgID: proto.Int64(orgID)},
		{name: "cloud organization", namespace: "stacks-123", orgID: proto.Int64(1)},
		{name: "root global request", orgID: proto.Int64(accesscontrol.GlobalOrgID), globalStore: true},
		{name: "root no membership request", orgID: proto.Int64(accesscontrol.NoOrgID), globalStore: true},
		{
			name: "invalid negative org", orgID: proto.Int64(accesscontrol.NoOrgID - 1),
			wantError: "requester org must be positive, 0 or NoOrgID",
		},
		{
			name: "organization mismatch", orgID: proto.Int64(orgID + 1),
			wantError: "requester org does not match namespace",
		},
		{
			name: "cloud organization mismatch", namespace: "stacks-123", orgID: proto.Int64(orgID),
			wantError: "requester org does not match namespace",
		},
		{
			name: "global still requires embedded provider", orgID: proto.Int64(accesscontrol.GlobalOrgID),
			wantError: "global evaluation requires a namespace belonging to the embedded instance",
		},
		{
			name: "global still requires a restriction", orgID: proto.Int64(accesscontrol.GlobalOrgID), globalStore: true,
			omitRestriction: true, wantError: "global evaluation requires an action restriction",
		},
		{
			name: "internal profile cannot select global", orgID: proto.Int64(accesscontrol.GlobalOrgID), internal: true,
			wantError: "internal legacy identity requires an organization requester",
		},
		{
			name: "internal profile cannot select no membership", orgID: proto.Int64(accesscontrol.NoOrgID), internal: true,
			wantError: "internal legacy identity requires an organization requester",
		},
		{name: "internal profile derives org from namespace", internal: true},
		{name: "internal profile with matching org", orgID: proto.Int64(orgID), internal: true},
		{
			name: "internal profile with mismatched org", orgID: proto.Int64(orgID + 1), internal: true,
			wantError: "requester org does not match namespace",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			grants := []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}}
			service := NewTestService("checked-user", grants, nil)
			if tc.globalStore {
				service, _ = newLegacyGlobalTestService(grants)
			}
			req := legacyPermissionRequest("user:checked-user", "users:read", "users:id:7")
			req.RequesterOrgId = tc.orgID
			if tc.namespace != "" {
				req.Namespace = tc.namespace
			}
			if !tc.omitRestriction {
				req.Restriction = &authzextv1.LegacyActionRestriction{Actions: []string{"users:read"}}
			}
			if tc.internal {
				service = service.WithLegacyScopeResolvers(nil, types.OrgNamespaceFormatter)
				req.InternalIdentity = &authzextv1.LegacyInternalIdentity{Profile: "service"}
				req.Subject, req.Restriction = "", nil
			}
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Rest: authn.AccessTokenClaims{Namespace: req.Namespace},
			}))

			// Exercise the embedded entry point for internal assertions as well.
			got, err := (&embeddedLegacyCheckServer{service: service}).LegacyCheck(ctx, req)

			require.NoError(t, err)
			want := &authzextv1.LegacyCheckResponse{Allowed: tc.wantError == "", Error: tc.wantError}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
			if tc.wantError != "" {
				require.Zero(t, service.store.(*fakeStore).calls)
			}
		})
	}
}

func TestLegacyCheckNamespace(t *testing.T) {
	for _, tc := range []struct {
		name            string
		namespace       string
		orgID           *int64
		stackID         string
		callerNamespace string
		standalone      bool
		wantNamespace   string
		wantError       string
	}{
		{name: "on-prem wildcard", namespace: "*", orgID: proto.Int64(12), wantNamespace: "org-12"},
		{name: "cloud wildcard", namespace: "*", orgID: proto.Int64(1), stackID: "123", wantNamespace: "stacks-123"},
		{name: "on-prem global wildcard", namespace: "*", orgID: proto.Int64(accesscontrol.GlobalOrgID), wantNamespace: "default"},
		{name: "on-prem no-membership wildcard", namespace: "*", orgID: proto.Int64(accesscontrol.NoOrgID), wantNamespace: "default"},
		{name: "cloud global wildcard", namespace: "*", orgID: proto.Int64(accesscontrol.GlobalOrgID), stackID: "123", wantNamespace: "stacks-123"},
		{name: "cloud no-membership wildcard", namespace: "*", orgID: proto.Int64(accesscontrol.NoOrgID), stackID: "123", wantNamespace: "stacks-123"},
		{name: "explicit namespace is preserved", namespace: "stacks-456", orgID: proto.Int64(1), stackID: "123", wantNamespace: "stacks-456"},
		{name: "standalone concrete namespace", namespace: "org-12", orgID: proto.Int64(12), standalone: true, wantNamespace: "org-12"},
		{name: "caller can access resolved target", namespace: "*", orgID: proto.Int64(12), callerNamespace: "org-12", wantNamespace: "org-12"},
		{
			name: "caller cannot access resolved target", namespace: "*", orgID: proto.Int64(12), callerNamespace: "org-13",
			wantError: "rpc error: code = PermissionDenied desc = namespace does not match",
		},
		{
			name: "cloud caller cannot access resolved stack", namespace: "*", orgID: proto.Int64(1), stackID: "123", callerNamespace: "stacks-456",
			wantError: "rpc error: code = PermissionDenied desc = namespace does not match",
		},
		{name: "missing org", namespace: "*", wantError: "legacy check requires requester org ID"},
		{name: "invalid org", namespace: "*", orgID: proto.Int64(-2), wantError: "requester org must be positive, 0 or NoOrgID"},
		{name: "standalone wildcard", namespace: "*", orgID: proto.Int64(12), standalone: true, wantError: "wildcard legacy namespace requires the embedded server"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stackID
			service := &Service{}
			if !tc.standalone {
				service = service.WithLegacyScopeResolvers(nil, apirequest.GetNamespaceMapper(cfg))
			}
			callerNamespace := tc.callerNamespace
			if callerNamespace == "" {
				callerNamespace = "*"
			}
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Rest: authn.AccessTokenClaims{Namespace: callerNamespace},
			}))
			req := &authzextv1.LegacyCheckRequest{Namespace: tc.namespace, RequesterOrgId: tc.orgID}
			original := proto.Clone(req)

			got, err := service.validateLegacyCheckNamespace(ctx, req)

			require.True(t, proto.Equal(original, req), "namespace resolution must preserve requester state")
			if tc.wantError != "" {
				require.EqualError(t, err, tc.wantError)
				require.Equal(t, types.NamespaceInfo{}, got)
				return
			}
			require.NoError(t, err)
			want, err := types.ParseNamespace(tc.wantNamespace)
			require.NoError(t, err)
			require.Equal(t, want, got)
		})
	}
}
