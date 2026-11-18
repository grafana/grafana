package authz

import (
	"context"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type allowAllClient struct{ authlib.AccessClient }

func (allowAllClient) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: true}, nil
}

func (allowAllClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func (allowAllClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(string, string) bool { return true }, nil, nil
}

func TestPersonalTokenAccessClient(t *testing.T) {
	c := withPersonalTokenGuard(allowAllClient{})
	ctx := context.Background()
	dash := func(verb string) authlib.CheckRequest {
		return authlib.CheckRequest{Verb: verb, Group: "dashboard.grafana.app", Resource: "dashboards"}
	}
	pat := func(scoped bool, perms map[string][]string) *user.SignedInUser {
		return &user.SignedInUser{
			AuthenticatedBy: login.PersonalTokenAuthModule, PersonalTokenResourceScoped: scoped,
			OrgID: 1, Permissions: map[int64]map[string][]string{1: perms},
		}
	}

	t.Run("resource-scoped token is denied everywhere", func(t *testing.T) {
		u := pat(true, map[string][]string{"dashboards:read": {"dashboards:uid:a"}})
		resp, err := c.Check(ctx, u, dash("get"), "")
		require.NoError(t, err)
		require.False(t, resp.Allowed)
		checker, _, err := c.Compile(ctx, u, authlib.ListRequest{Verb: "list", Group: "dashboard.grafana.app", Resource: "dashboards"})
		require.NoError(t, err)
		require.Nil(t, checker)
	})

	t.Run("token without the action is denied, including unmapped resources", func(t *testing.T) {
		u := pat(false, map[string][]string{"datasources:read": {"datasources:*"}})
		for _, r := range []authlib.CheckRequest{dash("get"), dash("create"), {Verb: "create", Group: "shorturl.grafana.app", Resource: "shorturls"}, {Verb: "list", Group: "playlist.grafana.app", Resource: "playlists"}} {
			resp, err := c.Check(ctx, u, r, "")
			require.NoError(t, err)
			require.False(t, resp.Allowed, r.Resource)
		}
		checker, _, err := c.Compile(ctx, u, authlib.ListRequest{Verb: "list", Group: "folder.grafana.app", Resource: "folders"})
		require.NoError(t, err)
		require.Nil(t, checker)
		br, err := c.BatchCheck(ctx, u, authlib.BatchCheckRequest{Checks: []authlib.BatchCheckItem{{CorrelationID: "a", Verb: "get", Group: "dashboard.grafana.app", Resource: "dashboards"}}})
		require.NoError(t, err)
		require.False(t, br.Results["a"].Allowed)
	})

	t.Run("token with the action passes only for that verb", func(t *testing.T) {
		u := pat(false, map[string][]string{"dashboards:read": {"dashboards:*"}})
		resp, err := c.Check(ctx, u, dash("list"), "")
		require.NoError(t, err)
		require.True(t, resp.Allowed)
		resp, err = c.Check(ctx, u, dash("update"), "")
		require.NoError(t, err)
		require.False(t, resp.Allowed)
		checker, _, err := c.Compile(ctx, u, authlib.ListRequest{Verb: "list", Group: "dashboard.grafana.app", Resource: "dashboards"})
		require.NoError(t, err)
		require.NotNil(t, checker)
		br, err := c.BatchCheck(ctx, u, authlib.BatchCheckRequest{Checks: []authlib.BatchCheckItem{
			{CorrelationID: "d", Verb: "get", Group: "dashboard.grafana.app", Resource: "dashboards"},
			{CorrelationID: "f", Verb: "get", Group: "folder.grafana.app", Resource: "folders"},
		}})
		require.NoError(t, err)
		require.False(t, br.Results["f"].Allowed, "unpermitted item denied")
		checker, _, err = c.Compile(ctx, u, authlib.ListRequest{Verb: "list", Group: "folder.grafana.app", Resource: "folders"})
		require.NoError(t, err)
		require.Nil(t, checker)
	})

	t.Run("non-token identities are unaffected", func(t *testing.T) {
		resp, err := c.Check(ctx, &user.SignedInUser{}, authlib.CheckRequest{Verb: "create", Group: "shorturl.grafana.app", Resource: "shorturls"}, "")
		require.NoError(t, err)
		require.True(t, resp.Allowed)
	})
}

type idTokenInfo struct {
	authlib.AuthInfo
	token string
}

func (i idTokenInfo) GetIDToken() string         { return i.token }
func (i idTokenInfo) GetAuthenticatedBy() string { return login.PersonalTokenAuthModule }

func TestPersonalTokenAccessClientIDTokenIdentity(t *testing.T) {
	c := withPersonalTokenGuard(allowAllClient{})
	req := authlib.CheckRequest{Verb: "get", Group: "folder.grafana.app", Resource: "folders"}

	// Without remembered grants the limits are unknown, so access is denied.
	resp, err := c.Check(context.Background(), idTokenInfo{token: "unknown"}, req, "")
	require.NoError(t, err)
	require.False(t, resp.Allowed)

	patscope.RememberGrants("known", patscope.Grants{Permissions: map[string][]string{"folders:read": {"*"}}}, time.Now().Add(time.Minute))
	resp, err = c.Check(context.Background(), idTokenInfo{token: "known"}, req, "")
	require.NoError(t, err)
	require.True(t, resp.Allowed)

	patscope.RememberGrants("narrow", patscope.Grants{Permissions: map[string][]string{"datasources:read": {"*"}}}, time.Now().Add(time.Minute))
	resp, err = c.Check(context.Background(), idTokenInfo{token: "narrow"}, req, "")
	require.NoError(t, err)
	require.False(t, resp.Allowed)
}
