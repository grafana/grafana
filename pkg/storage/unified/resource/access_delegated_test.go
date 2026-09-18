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

func newLimitedClient(t *testing.T) *authzLimitedClient {
	t.Helper()
	c, ok := NewAuthzLimitedClient(authlib.FixedAccessClient(false), AuthzOptions{Registry: prometheus.NewRegistry()}).(*authzLimitedClient)
	require.True(t, ok)
	return c
}

func missingDelegatedCount(c *authzLimitedClient, group, resource, verb string) float64 {
	return testutil.ToFloat64(c.metrics.missingDelegatedPermission.WithLabelValues(group, resource, verb))
}

func TestWarnIfServiceCannotDelegate(t *testing.T) {
	for name, tc := range map[string]struct {
		id        authlib.AuthInfo
		wantCount float64
	}{
		"no delegated permissions": {
			id:        userWithDelegatedPermissions(),
			wantCount: 1,
		},
		"delegated permission present": {
			id:        userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
			wantCount: 0,
		},
		// Without a user there is nothing to delegate.
		"service call without a user is not reported": {
			id:        &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"},
			wantCount: 0,
		},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)

			c.warnIfServiceCannotDelegate(context.Background(), tc.id, "dashboard.grafana.app", "dashboards", utils.VerbGet)

			assert.Equal(t, tc.wantCount, missingDelegatedCount(c, "dashboard.grafana.app", "dashboards", utils.VerbGet))
		})
	}
}

func TestAuthzLimitedClient_ReportsMissingDelegatedPermission(t *testing.T) {
	const group, res = "dashboard.grafana.app", "dashboards"
	id := userWithDelegatedPermissions()

	t.Run("Check", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1",
		}, "folder1")
		require.NoError(t, err)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("Compile", func(t *testing.T) {
		c := newLimitedClient(t)
		_, _, err := c.Compile(context.Background(), id, authlib.ListRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbList,
		})
		require.NoError(t, err)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbList))
	})

	t.Run("BatchCheck reports once per group, resource and verb", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.BatchCheck(context.Background(), id, authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "2", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash2"},
				{CorrelationID: "3", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet, Name: "f1"},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
		assert.Equal(t, 1.0, missingDelegatedCount(c, "folder.grafana.app", "folders", utils.VerbGet))
	})

	t.Run("resources that are not RBAC enforced are not reported", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: "playlist.grafana.app", Resource: "playlists", Verb: utils.VerbGet, Name: "p1",
		}, "")
		require.NoError(t, err)
		assert.Equal(t, 0.0, missingDelegatedCount(c, "playlist.grafana.app", "playlists", utils.VerbGet))
	})
}
