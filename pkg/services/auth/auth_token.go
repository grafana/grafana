package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/serverlock"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	registry.RegisterService(&UserAuthTokenService{})
}

var getTime = time.Now

const urgentRotateTime = 1 * time.Minute

type UserAuthTokenService struct {
	SQLStore          *sqlstore.SqlStore            `inject:""`
	ServerLockService *serverlock.ServerLockService `inject:""`
	Cfg               *setting.Cfg                  `inject:""`
	log               log.Logger
}

func (s *UserAuthTokenService) Init() error {
	s.log = log.New("auth")
	return nil
}

func (s *UserAuthTokenService) ActiveTokenCount(ctx context.Context) (int64, error) {
	var count int64
	var err error
	err = s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var model userAuthToken
		count, err = dbSession.Where(`created_at > ? AND rotated_at > ?`,
			s.createdAfterParam(),
			s.rotatedAfterParam()).
			Count(&model)

		return err
	})

	return count, err
}

func (s *UserAuthTokenService) CreateToken(ctx context.Context, userId int64, clientAddr, userAgent string) (*models.UserToken, error) {
	clientIP, err := util.ParseIPAddress(clientAddr)
	if err != nil {
		s.log.Debug("Failed to parse client IP address", "clientAddr", clientAddr, "err", err)
		clientIP = ""
	}
	token, err := util.RandomHex(16)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(token)

	now := getTime().Unix()

	userAuthToken := userAuthToken{
		UserId:        userId,
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIp:      clientIP,
		UserAgent:     userAgent,
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
		SeenAt:        0,
		AuthTokenSeen: false,
	}

	err = s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		_, err = dbSession.Insert(&userAuthToken)
		return err
	})

	if err != nil {
		return nil, err
	}

	userAuthToken.UnhashedToken = token

	s.log.Debug("user auth token created", "tokenId", userAuthToken.Id, "userId", userAuthToken.UserId, "clientIP", userAuthToken.ClientIp, "userAgent", userAuthToken.UserAgent, "authToken", userAuthToken.AuthToken)

	var userToken models.UserToken
	err = userAuthToken.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) LookupToken(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
	hashedToken := hashToken(unhashedToken)
	if setting.Env == setting.Dev {
		s.log.Debug("looking up token", "unhashed", unhashedToken, "hashed", hashedToken)
	}

	var model userAuthToken
	var exists bool
	var err error
	err = s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		exists, err = dbSession.Where("(auth_token = ? OR prev_auth_token = ?) AND created_at > ? AND rotated_at > ?",
			hashedToken,
			hashedToken,
			s.createdAfterParam(),
			s.rotatedAfterParam()).
			Get(&model)

		return err
	})
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, models.ErrUserTokenNotFound
	}

	if model.AuthToken != hashedToken && model.PrevAuthToken == hashedToken && model.AuthTokenSeen {
		modelCopy := model
		modelCopy.AuthTokenSeen = false
		expireBefore := getTime().Add(-urgentRotateTime).Unix()

		var affectedRows int64
		err = s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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
			s.log.Debug("prev seen token unchanged", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			s.log.Debug("prev seen token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	if !model.AuthTokenSeen && model.AuthToken == hashedToken {
		modelCopy := model
		modelCopy.AuthTokenSeen = true
		modelCopy.SeenAt = getTime().Unix()

		var affectedRows int64
		err = s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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
			s.log.Debug("seen wrong token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		} else {
			s.log.Debug("seen token", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent, "authToken", model.AuthToken)
		}
	}

	model.UnhashedToken = unhashedToken

	var userToken models.UserToken
	err = model.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) TryRotateToken(ctx context.Context, token *models.UserToken,
	clientAddr, userAgent string) (bool, error) {
	if token == nil {
		return false, nil
	}

	model, err := userAuthTokenFromUserToken(token)
	if err != nil {
		return false, err
	}

	now := getTime()

	var needsRotation bool
	rotatedAt := time.Unix(model.RotatedAt, 0)
	if model.AuthTokenSeen {
		needsRotation = rotatedAt.Before(now.Add(-time.Duration(s.Cfg.TokenRotationIntervalMinutes) * time.Minute))
	} else {
		needsRotation = rotatedAt.Before(now.Add(-urgentRotateTime))
	}

	if !needsRotation {
		return false, nil
	}

	s.log.Debug("token needs rotation", "tokenId", model.Id, "authTokenSeen", model.AuthTokenSeen, "rotatedAt", rotatedAt)

	clientIP, err := util.ParseIPAddress(clientAddr)
	if err != nil {
		s.log.Debug("Failed to parse client IP address", "clientAddr", clientAddr, "err", err)
		clientIP = ""
	}

	newToken, err := util.RandomHex(16)
	if err != nil {
		return false, err
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
	err = s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		res, err := dbSession.Exec(sql, userAgent, clientIP, s.SQLStore.Dialect.BooleanStr(true), hashedToken, s.SQLStore.Dialect.BooleanStr(false), now.Unix(), model.Id, s.SQLStore.Dialect.BooleanStr(true), now.Add(-30*time.Second).Unix())
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		return err
	})

	if err != nil {
		return false, err
	}

	s.log.Debug("auth token rotated", "affected", affected, "auth_token_id", model.Id, "userId", model.UserId)
	if affected > 0 {
		model.UnhashedToken = newToken
		if err := model.toUserToken(token); err != nil {
			return false, err
		}
		return true, nil
	}

	return false, nil
}

func (s *UserAuthTokenService) RevokeToken(ctx context.Context, token *models.UserToken) error {
	if token == nil {
		return models.ErrUserTokenNotFound
	}

	model, err := userAuthTokenFromUserToken(token)
	if err != nil {
		return err
	}

	var rowsAffected int64
	err = s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		rowsAffected, err = dbSession.Delete(model)
		return err
	})

	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		s.log.Debug("user auth token not found/revoked", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent)
		return models.ErrUserTokenNotFound
	}

	s.log.Debug("user auth token revoked", "tokenId", model.Id, "userId", model.UserId, "clientIP", model.ClientIp, "userAgent", model.UserAgent)

	return nil
}

func (s *UserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	return s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sql := `DELETE from user_auth_token WHERE user_id = ?`
		res, err := dbSession.Exec(sql, userId)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		s.log.Debug("all user tokens for user revoked", "userId", userId, "count", affected)

		return err
	})
}

func (s *UserAuthTokenService) BatchRevokeAllUserTokens(ctx context.Context, userIds []int64) error {
	return s.SQLStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
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

		s.log.Debug("all user tokens for given users revoked", "usersCount", len(userIds), "count", affected)

		return err
	})
}

func (s *UserAuthTokenService) GetUserToken(ctx context.Context, userId, userTokenId int64) (*models.UserToken, error) {
	var result models.UserToken
	err := s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var token userAuthToken
		exists, err := dbSession.Where("id = ? AND user_id = ?", userTokenId, userId).Get(&token)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrUserTokenNotFound
		}

		return token.toUserToken(&result)
	})

	return &result, err
}

func (s *UserAuthTokenService) GetUserTokens(ctx context.Context, userId int64) ([]*models.UserToken, error) {
	result := []*models.UserToken{}
	err := s.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var tokens []*userAuthToken
		err := dbSession.Where("user_id = ? AND created_at > ? AND rotated_at > ?",
			userId,
			s.createdAfterParam(),
			s.rotatedAfterParam()).
			Find(&tokens)
		if err != nil {
			return err
		}

		for _, token := range tokens {
			var userToken models.UserToken
			if err := token.toUserToken(&userToken); err != nil {
				return err
			}
			result = append(result, &userToken)
		}

		return nil
	})

	return result, err
}

func (s *UserAuthTokenService) createdAfterParam() int64 {
	return getTime().Add(-s.Cfg.LoginMaxLifetime).Unix()
}

func (s *UserAuthTokenService) rotatedAfterParam() int64 {
	return getTime().Add(-s.Cfg.LoginMaxInactiveLifetime).Unix()
}

func hashToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token + setting.SecretKey))
	return hex.EncodeToString(hashBytes[:])
}
