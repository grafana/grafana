package palettes_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/palettes"
	paletteutils "github.com/grafana/grafana/pkg/registry/apis/palettes/utils"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

const (
	apiGroup            = "palettes.grafana.app"
	delegatedPalettesRW = "palettes.grafana.app/palettes:*"
)

func newInner(access authlib.AccessClient) *prefutils.AuthorizeFromName {
	return &prefutils.AuthorizeFromName{
		AccessClient: access,
		Resource: map[string][]prefutils.ResourceOwner{
			palettes.Resource: {
				prefutils.NamespaceResourceOwner,
				prefutils.UserResourceOwner,
				prefutils.TeamResourceOwner,
			},
		},
		OwnerRefFromName: func(name string) (prefutils.OwnerReference, bool) {
			o, _, ok := paletteutils.ParseOwnerWithSuffix(name)
			return o, ok
		},
	}
}

func withDelegatedPerms(u *identity.StaticRequester, perms ...string) *identity.StaticRequester {
	u.AccessTokenClaims = &authn.Claims[authn.AccessTokenClaims]{
		Rest: authn.AccessTokenClaims{
			DelegatedPermissions: perms,
		},
	}
	return u
}

func TestPaletteAuthorizer(t *testing.T) {
	alice := withDelegatedPerms(&identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "alice",
		OrgRole: identity.RoleViewer,
	}, delegatedPalettesRW)

	carol := withDelegatedPerms(&identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "carol",
		OrgRole: identity.RoleViewer,
	}, delegatedPalettesRW)

	bobAdmin := withDelegatedPerms(&identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "bob",
		OrgRole: identity.RoleAdmin,
	}, delegatedPalettesRW)

	authz := palettes.NewPaletteAuthorizer(newInner(authlib.FixedAccessClient(false)))

	t.Run("anon get allows without requester", func(t *testing.T) {
		ctx := context.Background()
		d, reason, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "user-alice-sunset",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
		require.Empty(t, reason)
	})

	t.Run("regular user get on someone else's palette allows", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), carol)
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "user-alice-sunset",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
	})

	t.Run("regular user update on someone else's palette denies", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), carol)
		d, reason, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "update",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "user-alice-sunset",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, d)
		require.Equal(t, "your are not the owner of the resource", reason)
	})

	t.Run("admin update on another user's palette allows", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), bobAdmin)
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "update",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "user-alice-sunset",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
	})

	t.Run("admin update on team palette denies without IAM", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), bobAdmin)
		d, reason, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "update",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "team-frontend-warm",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, d)
		require.Equal(t, "no edit permissions for the team", reason)
	})

	t.Run("regular user create own palette allows", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), alice)
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "create",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			Name:            "user-alice-sunset",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
	})

	t.Run("list allows", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), alice)
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "list",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
	})

	t.Run("anon list denies", func(t *testing.T) {
		ctx := context.Background()
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "list",
			APIGroup:        apiGroup,
			Resource:        palettes.Resource,
			ResourceRequest: true,
		})
		require.Error(t, err)
		require.Equal(t, authorizer.DecisionDeny, d)
	})
}
