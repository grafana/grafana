package authimpl

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	ttl              = 15 * time.Second
	urgentRotateTime = 1 * time.Minute
)

var getTime = time.Now

func ProvideUserAuthTokenService(sqlStore db.DB,
	serverLockService *serverlock.ServerLockService,
	remoteCache *remotecache.RemoteCache,
	features *featuremgmt.FeatureManager,
	quotaService quota.Service,
	cfg *setting.Cfg) (*UserAuthTokenService, error) {
	s := &UserAuthTokenService{
		sqlStore:          sqlStore,
		serverLockService: serverLockService,
		cfg:               cfg,
		log:               log.New("auth"),
		remoteCache:       remoteCache,
		features:          features,
		singleflight:      new(singleflight.Group),
	}

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return s, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     auth.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.reportActiveTokenCount,
	}); err != nil {
		return s, err
	}

	remotecache.Register(auth.UserToken{})

	return s, nil
}

type UserAuthTokenService struct {
	sqlStore          db.DB
	serverLockService *serverlock.ServerLockService
	cfg               *setting.Cfg
	log               log.Logger
	remoteCache       *remotecache.RemoteCache
	features          *featuremgmt.FeatureManager
	singleflight      *singleflight.Group
}

func (s *UserAuthTokenService) CreateToken(ctx context.Context, user *user.User, clientIP net.IP, userAgent string) (*auth.UserToken, error) {
	token, err := util.RandomHex(16)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(token)

	now := getTime().Unix()
	clientIPStr := clientIP.String()
	if len(clientIP) == 0 {
		clientIPStr = ""
	}

	userAuthToken := userAuthToken{
		UserId:        user.ID,
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIp:      clientIPStr,
		UserAgent:     userAgent,
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
		SeenAt:        0,
		RevokedAt:     0,
		AuthTokenSeen: false,
	}

	err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		_, err = dbSession.Insert(&userAuthToken)
		return err
	})

	if err != nil {
		return nil, err
	}

	userAuthToken.UnhashedToken = token

	ctxLogger := s.log.FromContext(ctx)
	ctxLogger.Debug("user auth token created", "tokenId", userAuthToken.Id, "userId", userAuthToken.UserId, "clientIP", userAuthToken.ClientIp, "userAgent", userAuthToken.UserAgent, "authToken", userAuthToken.AuthToken)

	var userToken auth.UserToken
	err = userAuthToken.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) lookupTokenWithCache(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
	hashedToken := hashToken(unhashedToken)
	cacheKey := "auth_token:" + hashedToken

	session, errCache := s.remoteCache.Get(ctx, cacheKey)
	if errCache == nil {
		token := session.(auth.UserToken)
		return &token, nil
	} else {
		if errors.Is(errCache, remotecache.ErrCacheItemNotFound) {
			s.log.Debug("user auth token not found in cache",
				"cacheKey", cacheKey)
		} else {
			s.log.Warn("failed to get user auth token from cache",
				"cacheKey", cacheKey, "error", errCache)
		}
	}

	token, err := s.lookupToken(ctx, unhashedToken)
	if err != nil {
		return nil, err
	}

	// only cache tokens until their near rotation time
	// Near rotation time = tokens last rotation plus the rotation interval minus 2 ttl (=30s by default)
	nextRotation := time.Unix(token.RotatedAt, 0).
		Add(-2 * ttl). // subtract 2 ttl to make sure we don't cache tokens that are about to expire
		Add(time.Duration(s.cfg.TokenRotationIntervalMinutes) * time.Minute)
	if now := getTime(); now.Before(nextRotation) {
		if err := s.remoteCache.Set(ctx, cacheKey, *token, ttl); err != nil {
			s.log.Warn("could not cache token", "error", err, "cacheKey", cacheKey, "userId", token.UserId)
		}
	}

	return token, nil
}

func (s *UserAuthTokenService) LookupToken(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
	if s.features != nil && s.features.IsEnabled(featuremgmt.FlagSessionRemoteCache) {
		return s.lookupTokenWithCache(ctx, unhashedToken)
	}

	return s.lookupToken(ctx, unhashedToken)
}

func (s *UserAuthTokenService) lookupToken(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
	hashedToken := hashToken(unhashedToken)
	var model userAuthToken
	var exists bool
	var err error
	err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		exists, err = dbSession.Where("(auth_token = ? OR prev_auth_token = ?)",
			hashedToken,
			hashedToken).
			Get(&model)

		return err
	})
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, auth.ErrUserTokenNotFound
	}

	ctxLogger := s.log.FromContext(ctx)

	if model.RevokedAt > 0 {
		ctxLogger.Debug("user token has been revoked", "user ID", model.UserId, "token ID", model.Id)
		return nil, &auth.TokenRevokedError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	if model.CreatedAt <= s.createdAfterParam() || model.RotatedAt <= s.rotatedAfterParam() {
		ctxLogger.Debug("user token has expired", "user ID", model.UserId, "token ID", model.Id)
		return nil, &auth.TokenExpiredError{
			UserID:  model.UserId,
			TokenID: model.Id,
		}
	}

	// Current incoming token is the previous auth token in the DB and the auth_token_seen is true
	if model.AuthToken != hashedToken && model.PrevAuthToken == hashedToken && model.AuthTokenSeen {
		modelCopy := model
		modelCopy.AuthTokenSeen = false
		expireBefore := getTime().Add(-urgentRotateTime).Unix()

		var affectedRows int64
		err = s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Where("id = ? AND prev_auth_token = ? AND rotated_at < ?",
				modelCopy.Id,
				modelCopy.PrevAuthToken,
				expireBefore).
				AllCols().Update(&modelCopy)

			return err
		})

		if err != nil {
			return nil, err
		}

		if affectedRows == 0 {
			ctxLogger.Debug("prev seen token unchanged", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			ctxLogger.Debug("prev seen token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	// Current incoming token is not seen and it is the latest valid auth token in the db
	if !model.AuthTokenSeen && model.AuthToken == hashedToken {
		modelCopy := model
		modelCopy.AuthTokenSeen = true
		modelCopy.SeenAt = getTime().Unix()

		var affectedRows int64
		err = s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			affectedRows, err = dbSession.Where("id = ? AND auth_token = ?",
				modelCopy.Id,
				modelCopy.AuthToken).
				AllCols().Update(&modelCopy)

			return err
		})

		if err != nil {
			return nil, err
		}

		if affectedRows == 1 {
			model = modelCopy
		}

		if affectedRows == 0 {
			ctxLogger.Debug("seen wrong token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			ctxLogger.Debug("seen token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	model.UnhashedToken = unhashedToken

	var userToken auth.UserToken
	err = model.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) TryRotateToken(ctx context.Context, token *auth.UserToken,
	clientIP net.IP, userAgent string) (bool, *auth.UserToken, error) {
	if token == nil {
		return false, nil, nil
	}

	model, err := userAuthTokenFromUserToken(token)
	if err != nil {
		return false, nil, err
	}

	now := getTime()

	type rotationResult struct {
		rotated  bool
		newToken *auth.UserToken
	}

	rotResult, err, _ := s.singleflight.Do(fmt.Sprint(model.Id), func() (interface{}, error) {
		var needsRotation bool
		rotatedAt := time.Unix(model.RotatedAt, 0)
		if model.AuthTokenSeen {
			needsRotation = rotatedAt.Before(now.Add(-time.Duration(s.cfg.TokenRotationIntervalMinutes) * time.Minute))
		} else {
			needsRotation = rotatedAt.Before(now.Add(-urgentRotateTime))
		}

		if !needsRotation {
			return &rotationResult{rotated: false}, nil
		}

		ctxLogger := s.log.FromContext(ctx)
		ctxLogger.Debug("token needs rotation", "tokenId", model.Id, "authTokenSeen", model.AuthTokenSeen, "rotatedAt", rotatedAt)

		clientIPStr := clientIP.String()
		if len(clientIP) == 0 {
			clientIPStr = ""
		}
		newToken, err := util.RandomHex(16)
		if err != nil {
			return nil, err
		}
		hashedToken := hashToken(newToken)

		// very important that auth_token_seen is set after the prev_auth_token = case when ... for mysql to function correctly
		sql := `
			UPDATE user_auth_token
			SET
				seen_at = 0,
				user_agent = ?,
				client_ip = ?,
				prev_auth_token = case when auth_token_seen = ? then auth_token else prev_auth_token end,
				auth_token = ?,
				auth_token_seen = ?,
				rotated_at = ?
			WHERE id = ? AND (auth_token_seen = ? OR rotated_at < ?)`

		var affected int64
		err = s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
			res, err := dbSession.Exec(sql, userAgent, clientIPStr, s.sqlStore.GetDialect().BooleanStr(true), hashedToken,
				s.sqlStore.GetDialect().BooleanStr(false), now.Unix(), model.Id, s.sqlStore.GetDialect().BooleanStr(true),
				now.Add(-30*time.Second).Unix())
			if err != nil {
				return err
			}

			affected, err = res.RowsAffected()
			return err
		})

		if err != nil {
			return nil, err
		}

		if affected > 0 {
			ctxLogger.Debug("auth token rotated", "affected", affected, "auth_token_id", model.Id, "userId", model.UserId)
			model.UnhashedToken = newToken
			var result auth.UserToken
			if err := model.toUserToken(&result); err != nil {
				return nil, err
			}
			return &rotationResult{
				rotated:  true,
				newToken: &result,
			}, nil
		}

		return &rotationResult{rotated: false}, nil
	})

	if err != nil {
		return false, nil, err
	}

	result := rotResult.(*rotationResult)

	return result.rotated, result.newToken, nil
}

func (s *UserAuthTokenService) RevokeToken(ctx context.Context, token *auth.UserToken, soft bool) error {
	if token == nil {
		return auth.ErrUserTokenNotFound
	}

	model, err := userAuthTokenFromUserToken(token)
	if err != nil {
		return err
	}

	var rowsAffected int64

	if soft {
		model.RevokedAt = getTime().Unix()
		err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.ID(model.Id).Update(model)
			return err
		})
	} else {
		err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
			rowsAffected, err = dbSession.Delete(model)
			return err
		})
	}

	if err != nil {
		return err
	}

	ctxLogger := s.log.FromContext(ctx)

	if rowsAffected == 0 {
		ctxLogger.Debug("user auth token not found/revoked", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent)
		return auth.ErrUserTokenNotFound
	}

	ctxLogger.Debug("user auth token revoked", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "soft", soft)

	return nil
}

func (s *UserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	return s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `DELETE from user_auth_token WHERE user_id = ?`
		res, err := dbSession.Exec(sql, userId)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		s.log.FromContext(ctx).Debug("all user tokens for user revoked", "userId", userId, "count", affected)

		return err
	})
}

func (s *UserAuthTokenService) BatchRevokeAllUserTokens(ctx context.Context, userIds []int64) error {
	return s.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		if len(userIds) == 0 {
			return nil
		}

		user_id_params := strings.Repeat(",?", len(userIds)-1)
		sql := "DELETE from user_auth_token WHERE user_id IN (?" + user_id_params + ")"

		params := []interface{}{sql}
		for _, v := range userIds {
			params = append(params, v)
		}

		res, err := dbSession.Exec(params...)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		s.log.FromContext(ctx).Debug("all user tokens for given users revoked", "usersCount", len(userIds), "count", affected)

		return err
	})
}

func (s *UserAuthTokenService) GetUserToken(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
	var result auth.UserToken
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var token userAuthToken
		exists, err := dbSession.Where("id = ? AND user_id = ?", userTokenId, userId).Get(&token)
		if err != nil {
			return err
		}

		if !exists {
			return auth.ErrUserTokenNotFound
		}

		return token.toUserToken(&result)
	})

	return &result, err
}

func (s *UserAuthTokenService) GetUserTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	result := []*auth.UserToken{}
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Where("user_id = ? AND created_at > ? AND rotated_at > ? AND revoked_at = 0",
			userId,
			s.createdAfterParam(),
			s.rotatedAfterParam()).
			Find(&tokens)
		if err != nil {
			return err
		}

		for _, token := range tokens {
			var userToken auth.UserToken
			if err := token.toUserToken(&userToken); err != nil {
				return err
			}
			result = append(result, &userToken)
		}

		return nil
	})

	return result, err
}

func (s *UserAuthTokenService) GetUserRevokedTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	result := []*auth.UserToken{}
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var tokens []*userAuthToken
		err := dbSession.Where("user_id = ? AND revoked_at > 0", userId).Find(&tokens)
		if err != nil {
			return err
		}

		for _, token := range tokens {
			var userToken auth.UserToken
			if err := token.toUserToken(&userToken); err != nil {
				return err
			}
			result = append(result, &userToken)
		}

		return nil
	})

	return result, err
}

func (s *UserAuthTokenService) reportActiveTokenCount(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error) {
	var count int64
	var err error
	err = s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		var model userAuthToken
		count, err = dbSession.Where(`created_at > ? AND rotated_at > ? AND revoked_at = 0`,
			getTime().Add(-s.cfg.LoginMaxLifetime).Unix(),
			getTime().Add(-s.cfg.LoginMaxInactiveLifetime).Unix()).
			Count(&model)

		return err
	})

	tag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return nil, err
	}
	u := &quota.Map{}
	u.Set(tag, count)

	return u, err
}

func (s *UserAuthTokenService) createdAfterParam() int64 {
	return getTime().Add(-s.cfg.LoginMaxLifetime).Unix()
}

func (s *UserAuthTokenService) rotatedAfterParam() int64 {
	return getTime().Add(-s.cfg.LoginMaxInactiveLifetime).Unix()
}

func hashToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token + setting.SecretKey))
	return hex.EncodeToString(hashBytes[:])
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(auth.QuotaTargetSrv, auth.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.Session)
	return limits, nil
}
