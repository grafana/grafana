package middleware

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	authproxy "github.com/grafana/grafana/pkg/middleware/auth_proxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var header = setting.AuthProxyHeaderName

func logUserIn(auth *authproxy.AuthProxy, username string, logger log.Logger, ignoreCache bool) (int64, *authproxy.Error) {
	logger.Debug("Trying to log user in", "username", username, "ignoreCache", ignoreCache)
	// Try to log in user via various providers
	id, err := auth.Login(logger, ignoreCache)
	if err != nil {
		logger.Error("Failed to login", "username", username, "message", err.Error(), "error", err.DetailsError,
			"ignoreCache", ignoreCache)
		return 0, err
	}
	return id, nil
}

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

	// If there is no header - we can't move forward
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

	id, err := logUserIn(auth, username, logger, false)
	if err != nil {
		ctx.Handle(407, err.Error(), err.DetailsError)
		return true
	}

	logger.Debug("Got user ID, getting full user info", "userID", id)

	user, err := auth.GetSignedUser(id)
	if err != nil {
		// The reason we couldn't find the user corresponding to the ID might be that the ID was found from a stale
		// cache entry. For example, if a user is deleted via the API, corresponding cache entries aren't invalidated
		// because cache keys are computed from request header values and not just the user ID. Meaning that
		// we can't easily derive cache keys to invalidate when deleting a user. To work around this, we try to
		// log the user in again without the cache.
		logger.Debug("Failed to get user info given ID, retrying without cache", "userID", id)
		if err := auth.RemoveUserFromCache(logger); err != nil {
			if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
				logger.Error("Got unexpected error when removing user from auth cache", "error", err)
			}
		}
		id, err = logUserIn(auth, username, logger, true)
		if err != nil {
			ctx.Handle(407, err.Error(), err.DetailsError)
			return true
		}

		user, err = auth.GetSignedUser(id)
		if err != nil {
			ctx.Handle(407, err.Error(), err.DetailsError)
			return true
		}
	}

	logger.Debug("Successfully got user info", "userID", user.UserId, "username", user.Login)

	// Add user info to context
	ctx.SignedInUser = user
	ctx.IsSignedIn = true

	// Remember user data in cache
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
