package middleware

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	authproxy "github.com/grafana/grafana/pkg/middleware/auth_proxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	macaron "gopkg.in/macaron.v1"
)

// Test initContextWithAuthProxy with a cached user ID that is no longer valid.
//
// In this case, the cache entry should be ignored/cleared and another attempt should be done to sign the user
// in without cache.
func TestInitContextWithAuthProxy_CachedInvalidUserID(t *testing.T) {
	const name = "markelog"
	const userID = int64(1)
	const orgID = int64(4)

	upsertHandler := func(cmd *models.UpsertUserCommand) error {
		require.Equal(t, name, cmd.ExternalUser.Login)
		cmd.Result = &models.User{Id: userID}
		return nil
	}
	getSignedUserHandler := func(cmd *models.GetSignedInUserQuery) error {
		// Simulate that the cached user ID is stale
		if cmd.UserId != userID {
			return models.ErrUserNotFound
		}

		cmd.Result = &models.SignedInUser{
			UserId: userID,
			OrgId:  orgID,
		}
		return nil
	}

	origHeaderName := setting.AuthProxyHeaderName
	origEnabled := setting.AuthProxyEnabled
	origHeaderProperty := setting.AuthProxyHeaderProperty
	bus.AddHandler("", upsertHandler)
	bus.AddHandler("", getSignedUserHandler)
	t.Cleanup(func() {
		setting.AuthProxyHeaderName = origHeaderName
		setting.AuthProxyEnabled = origEnabled
		setting.AuthProxyHeaderProperty = origHeaderProperty
		bus.ClearBusHandlers()
	})

	setting.AuthProxyHeaderName = "X-Killa"
	setting.AuthProxyEnabled = true
	setting.AuthProxyHeaderProperty = "username"
	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)
	store := remotecache.NewFakeStore(t)
	ctx := &models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{
				Request: req,
			},
			Data: map[string]interface{}{},
		},
		Logger: log.New("Test"),
	}
	req.Header.Add(setting.AuthProxyHeaderName, name)
	key := fmt.Sprintf(authproxy.CachePrefix, authproxy.HashCacheKey(name))

	t.Logf("Injecting stale user ID in cache with key %q", key)
	err = store.Set(key, int64(33), 0)
	require.NoError(t, err)

	authEnabled := initContextWithAuthProxy(store, ctx, orgID)
	require.True(t, authEnabled)

	require.Equal(t, userID, ctx.SignedInUser.UserId)
	require.True(t, ctx.IsSignedIn)

	i, err := store.Get(key)
	require.NoError(t, err)
	require.Equal(t, userID, i.(int64))
}
