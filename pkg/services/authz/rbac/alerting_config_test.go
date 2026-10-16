package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestAlertingConfigPermissions(t *testing.T) {
	for _, app := range []struct{ group, root string }{
		{"notifications.alerting.grafana.app", "configs"},
		{"rules.alerting.grafana.app", "rules-configs"},
	} {
		for _, tc := range []struct {
			name, action, scope, verb string
			allowed                   bool
		}{
			{"fixed reader", "get", app.root + ":*", "get", true},
			{"list", "get", app.root + ":*", "list", true},
			{"watch", "get", app.root + ":*", "watch", true},
			{"fixed writer", "update", app.root + ":*", "update", true},
			{"patch", "update", app.root + ":*", "patch", true},
			{"custom reader", "get", app.root + ":uid:default", "get", true},
			{"custom wildcard", "get", app.root + ":uid:*", "get", true},
			{"different object", "get", app.root + ":uid:other", "get", false},
			{"wrong scope", "get", "other-configs:uid:default", "get", false},
			{"reader cannot update", "get", app.root + ":*", "update", false},
			{"no grants", "", "", "get", false},
		} {
			t.Run(app.group+"/"+tc.name, func(t *testing.T) {
				var perms []accesscontrol.Permission
				if tc.action != "" {
					perms = []accesscontrol.Permission{{Action: app.group + "/configs:" + tc.action, Scope: tc.scope}}
				}
				service := NewTestService("user-1", perms, nil)
				ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
				result, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: app.group, Resource: "configs", Name: "default", Verb: tc.verb})
				require.NoError(t, err)
				require.Equal(t, tc.allowed, result.Allowed)
			})
		}
	}
}

func TestAlertingConfigMappingBoundaries(t *testing.T) {
	for _, group := range []string{"notifications.alerting.grafana.app", "rules.alerting.grafana.app"} {
		t.Run(group, func(t *testing.T) {
			mapping, ok := NewMapperRegistry().Get(group, "configs", "")
			require.True(t, ok)
			require.False(t, mapping.HasFolderSupport())
			for _, verb := range []string{"create", "delete", "deletecollection", "get_permissions", "set_permissions"} {
				_, ok = mapping.Action(verb)
				require.False(t, ok, verb)
			}
			service := NewTestService("user-1", []accesscontrol.Permission{{Action: group + "/configs:get", Scope: mapping.Scope("default")}}, nil)
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
			result, err := service.List(ctx, &authzv1.ListRequest{Namespace: "default", Subject: "user:user-1", Group: group, Resource: "configs", Verb: "list"})
			require.NoError(t, err)
			require.Equal(t, []string{"default"}, result.Items)
			require.False(t, result.All)
			require.Empty(t, result.Folders)
			otherGroup := "notifications.alerting.grafana.app"
			if group == otherGroup {
				otherGroup = "rules.alerting.grafana.app"
			}
			check, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: otherGroup, Resource: "configs", Name: "default", Verb: "get"})
			require.NoError(t, err)
			require.False(t, check.Allowed, "grants must not cross between config APIs")
		})
	}
}
