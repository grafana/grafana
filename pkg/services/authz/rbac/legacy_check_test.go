package rbac

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_LegacyCheck(t *testing.T) {
	newCallingService := func(namespace string) types.AuthInfo {
		return authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
			Claims: jwt.Claims{Subject: "service-account:test"},
			Rest: authn.AccessTokenClaims{
				Namespace: namespace,
			},
		})
	}

	t.Run("allows when legacy permission matches action+scope", func(t *testing.T) {
		s := setupService()
		f := s.store.(*fakeStore)
		f.userID = &store.UserIdentifiers{UID: "u-1", ID: 1}
		f.basicRole = &store.BasicRole{Role: "Viewer"}
		f.userPermissions = []accesscontrol.Permission{
			{
				Action:     "dashboards:read",
				Scope:      "dashboards:uid:dash-1",
				Kind:       "dashboards",
				Attribute:  "uid",
				Identifier: "dash-1",
			},
		}

		ctx := types.WithAuthInfo(context.Background(), newCallingService("org-12"))
		resp, err := s.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
			Namespace: "org-12",
			Subject:   "user:u-1",
			Action:    "dashboards:read",
			Scope:     "dashboards:uid:dash-1",
		})
		require.NoError(t, err)
		require.True(t, resp.GetAllowed())
		require.Empty(t, resp.GetError())
	})

	t.Run("returns deny-with-error on namespace mismatch", func(t *testing.T) {
		s := setupService()
		ctx := types.WithAuthInfo(context.Background(), newCallingService("org-12"))

		resp, err := s.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
			Namespace: "org-13",
			Subject:   "user:u-1",
			Action:    "dashboards:read",
			Scope:     "dashboards:uid:dash-1",
		})
		require.NoError(t, err)
		require.False(t, resp.GetAllowed())
		require.Contains(t, resp.GetError(), "namespace does not match")
	})
}
