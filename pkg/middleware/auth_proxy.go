package middleware

import (
	"github.com/grafana/grafana/pkg/infra/remotecache"
	authproxy "github.com/grafana/grafana/pkg/middleware/auth_proxy"
	m "github.com/grafana/grafana/pkg/models"
)

const (

	// cachePrefix is a prefix for the cache key
	cachePrefix = authproxy.CachePrefix
)

func initContextWithAuthProxy(store *remotecache.RemoteCache, ctx *m.ReqContext, orgID int64) bool {
	auth := authproxy.New(&authproxy.Options{
		Store: store,
		Ctx:   ctx,
		OrgID: orgID,
	})

	// Bail if auth proxy is not enabled
	if !auth.IsEnabled() {
		return false
	}

	// If the there is no header - we can't move forward
	if !auth.HasHeader() {
		return false
	}

	// Check if allowed to continue with this IP
	if result, err := auth.IsAllowedIP(); !result {
		ctx.Logger.Error("auth proxy: failed to check whitelisted ip addresses", "message", err.Error(), "error", err.DetailsError)
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	// Try to log in user from various providers
	id, err := auth.Login()
	if err != nil {
		ctx.Logger.Error("auth proxy: failed to login", "message", err.Error(), "error", err.DetailsError)
		ctx.Handle(500, err.Error(), err.DetailsError)
		return true
	}

	// Get full user info
	user, err := auth.GetSignedUser(id)
	if err != nil {
		ctx.Logger.Error("auth proxy: failed to get signed in user", "message", err.Error(), "error", err.DetailsError)
		ctx.Handle(500, err.Error(), err.DetailsError)
		return true
	}

	// Add user info to context
	ctx.SignedInUser = user
	ctx.IsSignedIn = true

	// Remember user data it in cache
	if err := auth.Remember(id); err != nil {
		ctx.Logger.Error("auth proxy: failed to store user in cache", "message", err.Error(), "error", err.DetailsError)
		ctx.Handle(500, err.Error(), err.DetailsError)
		return true
	}

	return true
}
