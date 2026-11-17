package acimpl

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPermissionShadowPreservesCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, warm := range []bool{false, true} {
		for _, reload := range []bool{false, true} {
			t.Run(fmt.Sprintf("warm=%t/reload=%t", warm, reload), func(t *testing.T) {
				s := setupTestEnv(t, false)
				s.cfg.RBAC.PermissionCache = true
				s.legacyShadow = newPermissionShadow(t, nil, 1)

				usr := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleNone}
				grant := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:fresh"}
				addContractUserGrant(t, s.sql, "managed:shadow", 1, 7, grant)

				key := ac.GetUserDirectPermissionCacheKey(usr)
				sentinel := []ac.Permission{{Action: "cached", Scope: "unchanged"}}
				if warm {
					s.cache.Set(key, sentinel, time.Minute)
				}

				want := []ac.Permission{{Action: "primary", Scope: "unchanged"}}
				got, err := s.legacyShadow.GetUserPermissions(t.Context(), s.legacyClient, usr, ac.Options{ReloadCache: reload}, s.cfg, func() ([]ac.Permission, error) {
					return want, nil
				})

				require.NoError(t, err)
				require.Equal(t, want, got)

				waitForShadow(t, s.legacyShadow, "error")

				cached, found := s.cache.Get(key)
				require.Equal(t, warm, found)
				if warm {
					require.Equal(t, sentinel, cached)
				}

				// The same embedded client must still write caches on authoritative calls.
				_, err = GetLegacyUserPermissions(t.Context(), s.legacyClient, usr, ac.Options{ReloadCache: true}, s.cfg)
				require.NoError(t, err)

				cached, found = s.cache.Get(key)
				require.True(t, found)
				require.Contains(t, cached, grant)
			})
		}
	}
}
