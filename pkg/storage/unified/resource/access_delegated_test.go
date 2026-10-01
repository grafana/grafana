package resource

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// userWithDelegatedPermissions mirrors what search-api sees when storage-api
// searches on behalf of a user.
func userWithDelegatedPermissions(delegated ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		Namespace: "stacks-1",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				Namespace:            "stacks-1",
				DelegatedPermissions: delegated,
			},
		},
	}
}

// tokenWithoutDelegation carries service permissions but no delegated ones,
// which is what storage-api's token looked like during the incident.
func tokenWithoutDelegation() *identity.StaticRequester {
	id := userWithDelegatedPermissions()
	id.AccessTokenClaims.Rest.Permissions = []string{"dashboards.insights:read"}
	return id
}

func newLimitedClient(t *testing.T) *authzLimitedClient {
	t.Helper()
	c, ok := NewAuthzLimitedClient(authlib.FixedAccessClient(true), AuthzOptions{Registry: prometheus.NewRegistry()}).(*authzLimitedClient)
	require.True(t, ok)
	return c
}

func missingDelegatedCount(c *authzLimitedClient, group, resource, verb string) float64 {
	return testutil.ToFloat64(c.metrics.missingDelegatedPermission.WithLabelValues(group, resource, verb))
}

func TestServiceCanDelegate(t *testing.T) {
	for name, tc := range map[string]struct {
		id        authlib.AuthInfo
		wantErr   bool
		wantCount float64
	}{
		// The incident shape: the token carries service permissions but cannot act
		// for a user on this resource.
		"token with permissions but none delegated": {
			id:        tokenWithoutDelegation(),
			wantErr:   true,
			wantCount: 1,
		},
		// Single-tenant and in-process callers carry no token permissions.
		"no token permissions at all": {
			id: userWithDelegatedPermissions(),
		},
		"delegated permission for the resource": {
			id: userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
		},
		// A permission without a resource covers every resource in the group.
		"delegated permission for the whole group": {
			id: userWithDelegatedPermissions("dashboard.grafana.app:get"),
		},
		// Without a user there is nothing to delegate.
		"service call without a user": {
			id: &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)

			err := c.serviceCanDelegate(context.Background(), tc.id, "dashboard.grafana.app", "dashboards", utils.VerbGet)

			if tc.wantErr {
				require.ErrorIs(t, err, ErrServiceCannotDelegate)
				assert.Contains(t, err.Error(), "dashboard.grafana.app/dashboards:get")
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantCount, missingDelegatedCount(c, "dashboard.grafana.app", "dashboards", utils.VerbGet))
		})
	}
}

// A token that cannot delegate is a deployment mistake, so every entry point
// fails instead of passing on a denial that reads as "the user has no access".
func TestAuthzLimitedClient_RefusesWhenServiceCannotDelegate(t *testing.T) {
	const group, res = "dashboard.grafana.app", "dashboards"
	id := tokenWithoutDelegation()

	t.Run("Check", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1",
		}, "folder1")
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.False(t, resp.Allowed)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("Compile", func(t *testing.T) {
		c := newLimitedClient(t)
		checker, _, err := c.Compile(context.Background(), id, authlib.ListRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbList,
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.Nil(t, checker)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbList))
	})

	t.Run("BatchCheck", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.BatchCheck(context.Background(), id, authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "2", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash2"},
			},
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		// Once per group, resource and verb, however many hits share it.
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("resources that are not RBAC enforced are unaffected", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: "playlist.grafana.app", Resource: "playlists", Verb: utils.VerbGet, Name: "p1",
		}, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
		assert.Equal(t, 0.0, missingDelegatedCount(c, "playlist.grafana.app", "playlists", utils.VerbGet))
	})

	t.Run("a token that can delegate reaches the underlying client", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
			authlib.CheckRequest{Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"}, "folder1")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
}
