package iam

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/require"
)

func ctxWithServiceIdentity(t *testing.T, serviceIdentity string) context.Context {
	t.Helper()

	return identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:    types.TypeAccessPolicy,
		UserUID: "test-access-policy",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				ServiceIdentity: serviceIdentity,
			},
		},
	})
}

func TestValidateCoreRoleServiceIdentityTarget(t *testing.T) {
	ctx := ctxWithServiceIdentity(t, "awesome-app")

	t.Run("allows plugins core role targeting same service identity", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_awesome-app.tea_drinker"
		require.NoError(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("denies plugins core role targeting different service identity", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_other-app.tea_drinker"
		require.Error(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("allows extsvc core role targeting same service identity", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "extsvc_awesome-app_serviceaccount"
		require.NoError(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("denies fixed core role", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "fixed_ice-cream_eater"
		require.Error(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("allows non-core actions when action is prefixed with service identity", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_awesome-app.tea_drinker"
		role.Spec.Permissions = []iamv0.CoreRolespecPermission{
			{Action: "awesome-app:tea:drink", Scope: "folders:*"},
			{Action: "awesome-app.tea.drink", Scope: "folders:*"},
		}
		require.NoError(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("denies non-core actions when action is not prefixed with service identity", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_awesome-app.tea_drinker"
		role.Spec.Permissions = []iamv0.CoreRolespecPermission{
			{Action: "other-app:tea:drink", Scope: "folders:*"},
		}
		require.Error(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("allows allowlisted core action only when scope targets the calling app", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_awesome-app.tea_drinker"
		role.Spec.Permissions = []iamv0.CoreRolespecPermission{
			{Action: "plugins:write", Scope: "plugins:id:awesome-app"},
		}
		require.NoError(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})

	t.Run("denies allowlisted core action when scope targets a different app", func(t *testing.T) {
		role := &iamv0.CoreRole{}
		role.Name = "plugins_awesome-app.tea_drinker"
		role.Spec.Permissions = []iamv0.CoreRolespecPermission{
			{Action: "plugins:write", Scope: "plugins:id:other-app"},
		}
		require.Error(t, validateCoreRoleServiceIdentityTarget(ctx, role))
	})
}
