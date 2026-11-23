package app

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestGetAuthorizer(t *testing.T) {
	auth := GetAuthorizer()

	newContext := func(role authlib.RoleType) context.Context {
		return identity.WithRequester(context.Background(), &identity.StaticRequester{OrgRole: role})
	}

	allRoles := []authlib.RoleType{authlib.RoleNone, authlib.RoleViewer, authlib.RoleEditor, authlib.RoleAdmin}

	t.Run("non-resource requests get no opinion", func(t *testing.T) {
		decision, _, err := auth.Authorize(context.Background(), authorizer.AttributesRecord{
			ResourceRequest: false,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("missing requester is denied", func(t *testing.T) {
		decision, _, err := auth.Authorize(context.Background(), authorizer.AttributesRecord{
			ResourceRequest: true,
			Verb:            "list",
		})
		require.Error(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	// create and get (read) are available to any authenticated user, including
	// org role None, preserving the legacy /api/short-urls and goto-redirect
	// behaviour.
	for _, verb := range []string{"create", "get"} {
		t.Run(verb+" is allowed for any authenticated user", func(t *testing.T) {
			for _, role := range allRoles {
				decision, _, err := auth.Authorize(newContext(role), authorizer.AttributesRecord{
					ResourceRequest: true,
					Verb:            verb,
				})
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionAllow, decision, "role %s should be allowed to %s", role, verb)
			}
		})
	}

	// list/watch, delete and updates to the resource or its status subresource
	// are restricted to admins. The goto redirect bumps lastSeenAt on the status
	// subresource under a provisioning identity, so it does not need this grant.
	restrictedCases := []struct {
		verb        string
		subresource string
	}{
		{"list", ""},
		{"watch", ""},
		{"delete", ""},
		{"deletecollection", ""},
		{"update", ""},
		{"patch", ""},
		{"update", "status"},
		{"patch", "status"},
	}
	for _, tc := range restrictedCases {
		name := tc.verb
		if tc.subresource != "" {
			name += "/" + tc.subresource
		}
		t.Run(name+" is denied for None, Viewer and Editor", func(t *testing.T) {
			for _, role := range []authlib.RoleType{authlib.RoleNone, authlib.RoleViewer, authlib.RoleEditor} {
				decision, _, err := auth.Authorize(newContext(role), authorizer.AttributesRecord{
					ResourceRequest: true,
					Verb:            tc.verb,
					Subresource:     tc.subresource,
				})
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision, "role %s should not be allowed to %s", role, name)
			}
		})

		t.Run(name+" is allowed for Admin", func(t *testing.T) {
			decision, _, err := auth.Authorize(newContext(authlib.RoleAdmin), authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            tc.verb,
				Subresource:     tc.subresource,
			})
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision, "admin should be allowed to %s", name)
		})
	}

	t.Run("service identity may list and delete (stale URL cleanup)", func(t *testing.T) {
		// The background cleanup job lists and deletes stale short URLs via the
		// k8s API using a service identity (org role Admin), which must keep
		// working.
		ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
		for _, verb := range []string{"list", "delete"} {
			decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            verb,
			})
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision)
		}
	})
}
