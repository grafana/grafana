package acimpl

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLegacyRoutingPreservesRequesterCacheKey(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagAuthzLegacyUserPermissions: {State: memprovider.Enabled, Variants: map[string]any{"value": true}, DefaultVariant: "value"},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	requester := &identity.StaticRequester{Type: types.TypeUser, UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: identity.RoleNone, CacheKey: "caller-specific-key"}
	addContractUserGrant(t, s.sql, "managed:one", 1, 7, ac.Permission{Action: "users:read", Scope: "users:uid:old"})
	_, err := s.GetUserPermissions(context.Background(), requester, ac.Options{})
	require.NoError(t, err)
	require.NoError(t, s.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", "users:uid:new", "users:uid:old")
		return err
	}))
	s.ClearUserPermissionCache(requester)
	got, err := s.GetUserPermissions(context.Background(), requester, ac.Options{})
	require.NoError(t, err)
	require.ElementsMatch(t, []ac.Permission{SharedWithMeFolderPermission, {Action: "users:read", Scope: "users:uid:new"}}, got)
}
