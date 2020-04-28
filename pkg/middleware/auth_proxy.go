package middleware

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	authproxy "github.com/grafana/grafana/pkg/middleware/auth_proxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var header = setting.AuthProxyHeaderName

func initContextWithAuthProxy(store *remotecache.RemoteCache, ctx *models.ReqContext, orgID int64) bool {
	username := ctx.Req.Header.Get(header)
	auth := authproxy.New(&authproxy.Options{
		Store: store,
		Ctx:   ctx,
		OrgID: orgID,
	})

	logger := log.New("auth.proxy")

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
		logger.Error(
			"Failed to check whitelisted IP addresses",
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	// Try to log in user from various providers
	id, err := auth.Login()
	if err != nil {
		logger.Error(
			"Failed to login",
			"username", username,
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	// Get full user info
	user, err := auth.GetSignedUser(id)
	if err != nil {
		logger.Error(
			"Failed to get signed user",
			"username", username,
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	// Add user info to context
	ctx.SignedInUser = user
	ctx.IsSignedIn = true

	// Remember user data it in cache
	if err := auth.Remember(id); err != nil {
		logger.Error(
			"Failed to store user in cache",
			"username", username,
			"message", err.Error(),
			"error", err.DetailsError,
		)
		ctx.Handle(500, err.Error(), err.DetailsError)
		return true
	}

	return true
}
