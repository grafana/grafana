package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/grafana/grafana/pkg/infra/serverlock"

	"github.com/grafana/grafana/pkg/log"
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

func (s *UserAuthTokenService) ActiveTokenCount() (int64, error) {
	var model userAuthToken
	count, err := s.SQLStore.NewSession().Where(`created_at > ? AND rotated_at > ?`, s.createdAfterParam(), s.rotatedAfterParam()).Count(&model)

	return count, err
}

func (s *UserAuthTokenService) CreateToken(userId int64, clientIP, userAgent string) (*models.UserToken, error) {
	clientIP = util.ParseIPAddress(clientIP)
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
	_, err = s.SQLStore.NewSession().Insert(&userAuthToken)
	if err != nil {
		return nil, err
	}

	userAuthToken.UnhashedToken = token

	s.log.Debug("user auth token created", "tokenId", userAuthToken.Id, "userId", userAuthToken.UserId, "clientIP", userAuthToken.ClientIp, "userAgent", userAuthToken.UserAgent, "authToken", userAuthToken.AuthToken)

	var userToken models.UserToken
	err = userAuthToken.toUserToken(&userToken)

	return &userToken, err
}

func (s *UserAuthTokenService) LookupToken(unhashedToken string) (*models.UserToken, error) {
	hashedToken := hashToken(unhashedToken)
	if setting.Env == setting.DEV {
		s.log.Debug("looking up token", "unhashed", unhashedToken, "hashed", hashedToken)
	}

	var model userAuthToken
	exists, err := s.SQLStore.NewSession().Where("(auth_token = ? OR prev_auth_token = ?) AND created_at > ? AND rotated_at > ?", hashedToken, hashedToken, s.createdAfterParam(), s.rotatedAfterParam()).Get(&model)
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
		affectedRows, err := s.SQLStore.NewSession().Where("id = ? AND prev_auth_token = ? AND rotated_at < ?", modelCopy.Id, modelCopy.PrevAuthToken, expireBefore).AllCols().Update(&modelCopy)
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
		affectedRows, err := s.SQLStore.NewSession().Where("id = ? AND auth_token = ?", modelCopy.Id, modelCopy.AuthToken).AllCols().Update(&modelCopy)
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

func (s *UserAuthTokenService) TryRotateToken(token *models.UserToken, clientIP, userAgent string) (bool, error) {
	if token == nil {
		return false, nil
	}

	model := userAuthTokenFromUserToken(token)

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

	clientIP = util.ParseIPAddress(clientIP)
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

	res, err := s.SQLStore.NewSession().Exec(sql, userAgent, clientIP, s.SQLStore.Dialect.BooleanStr(true), hashedToken, s.SQLStore.Dialect.BooleanStr(false), now.Unix(), model.Id, s.SQLStore.Dialect.BooleanStr(true), now.Add(-30*time.Second).Unix())
	if err != nil {
		return false, err
	}

	affected, _ := res.RowsAffected()
	s.log.Debug("auth token rotated", "affected", affected, "auth_token_id", model.Id, "userId", model.UserId)
	if affected > 0 {
		model.UnhashedToken = newToken
		model.toUserToken(token)
		return true, nil
	}

	return false, nil
}

func (s *UserAuthTokenService) RevokeToken(token *models.UserToken) error {
	if token == nil {
		return models.ErrUserTokenNotFound
	}

	model := userAuthTokenFromUserToken(token)

	rowsAffected, err := s.SQLStore.NewSession().Delete(model)
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

func (s *UserAuthTokenService) RevokeAllUserTokens(userId int64) error {
	sql := `DELETE from user_auth_token WHERE user_id = ?`
	res, err := s.SQLStore.NewSession().Exec(sql, userId)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	s.log.Debug("all user tokens for user revoked", "userId", userId, "count", affected)

	return nil
}

func (s *UserAuthTokenService) GetUserToken(userId, userTokenId int64) (*models.UserToken, error) {
	var token userAuthToken
	exists, err := s.SQLStore.NewSession().Where("id = ? AND user_id = ?", userTokenId, userId).Get(&token)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, models.ErrUserTokenNotFound
	}

	var result models.UserToken
	token.toUserToken(&result)

	return &result, nil
}

func (s *UserAuthTokenService) GetUserTokens(userId int64) ([]*models.UserToken, error) {
	var tokens []*userAuthToken
	err := s.SQLStore.NewSession().Where("user_id = ? AND created_at > ? AND rotated_at > ?", userId, s.createdAfterParam(), s.rotatedAfterParam()).Find(&tokens)
	if err != nil {
		return nil, err
	}

	result := []*models.UserToken{}
	for _, token := range tokens {
		var userToken models.UserToken
		token.toUserToken(&userToken)
		result = append(result, &userToken)
	}

	return result, nil
}

func (s *UserAuthTokenService) createdAfterParam() int64 {
	tokenMaxLifetime := time.Duration(s.Cfg.LoginMaxLifetimeDays) * 24 * time.Hour
	return getTime().Add(-tokenMaxLifetime).Unix()
}

func (s *UserAuthTokenService) rotatedAfterParam() int64 {
	tokenMaxInactiveLifetime := time.Duration(s.Cfg.LoginMaxInactiveLifetimeDays) * 24 * time.Hour
	return getTime().Add(-tokenMaxInactiveLifetime).Unix()
}

func hashToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token + setting.SecretKey))
	return hex.EncodeToString(hashBytes[:])
}
