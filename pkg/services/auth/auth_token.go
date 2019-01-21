package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"time"

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

var (
	now              = time.Now
	RotateTime       = 10 * time.Second
	UrgentRotateTime = 5 * time.Second
)

// UserAuthTokenService are used for generating and validating user auth tokens
type UserAuthTokenService struct {
	SQLStore *sqlstore.SqlStore `inject:""`
	log      log.Logger
}

// Init this service
func (s *UserAuthTokenService) Init() error {
	s.log = log.New("auth")
	return nil
}

const sessionCookieKey = "grafana_session"

func (s *UserAuthTokenService) UserAuthenticatedHook(user *models.User, c *models.ReqContext) error {
	userToken, err := s.CreateToken(user.Id, c.RemoteAddr(), c.Req.UserAgent())
	if err != nil {
		return err
	}

	c.Resp.Header().Del("Set-Cookie")
	cookie := http.Cookie{
		Name:     sessionCookieKey,
		Value:    url.QueryEscape(userToken.UnhashedToken),
		HttpOnly: true,
		Domain:   setting.Domain,
		Path:     setting.AppSubUrl + "/",
	}

	http.SetCookie(c.Resp, &cookie)

	return nil
}

func (s *UserAuthTokenService) UserSignedOutHook(c *models.ReqContext) {
	c.Resp.Header().Del("Set-Cookie")
	cookie := http.Cookie{
		Name:     sessionCookieKey,
		Value:    "",
		HttpOnly: true,
		Domain:   setting.Domain,
		Path:     setting.AppSubUrl + "/",
	}
	http.SetCookie(c.Resp, &cookie)
}

func (s *UserAuthTokenService) CreateToken(userId int64, clientIP, userAgent string) (*models.UserAuthToken, error) {
	clientIP = util.ParseIPAddress(clientIP)
	token, err := util.RandomHex(16)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(token)

	userToken := models.UserAuthToken{
		UserId:        userId,
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIp:      clientIP,
		UserAgent:     userAgent,
		RotatedAt:     now().Unix(),
		CreatedAt:     now().Unix(),
		UpdatedAt:     now().Unix(),
		SeenAt:        0,
		AuthTokenSeen: false,
	}
	_, err = s.SQLStore.NewSession().Insert(&userToken)
	if err != nil {
		return nil, err
	}

	userToken.UnhashedToken = token

	return &userToken, nil
}

func (s *UserAuthTokenService) LookupToken(unhashedToken string) (*models.UserAuthToken, error) {
	hashedToken := hashToken(unhashedToken)

	var userToken models.UserAuthToken
	exists, err := s.SQLStore.NewSession().Where("auth_token = ? OR prev_auth_token = ?", hashedToken, hashedToken).Get(&userToken)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, ErrAuthTokenNotFound
	}

	if userToken.AuthToken != hashedToken && userToken.PrevAuthToken == hashedToken && userToken.AuthTokenSeen {
		userToken.AuthTokenSeen = false
		expireBefore := now().Add(-RotateTime).Unix()
		affectedRows, err := s.SQLStore.NewSession().Where("id = ? AND prev_auth_token = ? AND rotated_at < ?", userToken.Id, userToken.PrevAuthToken, expireBefore).AllCols().Update(&userToken)
		if err != nil {
			return nil, err
		}

		if affectedRows == 0 {
			s.log.Debug("prev seen token unchanged", "userTokenId", userToken.Id, "userId", userToken.UserId, "authToken", userToken.AuthToken, "clientIP", userToken.ClientIp, "userAgent", userToken.UserAgent)
		} else {
			s.log.Debug("prev seen token", "userTokenId", userToken.Id, "userId", userToken.UserId, "authToken", userToken.AuthToken, "clientIP", userToken.ClientIp, "userAgent", userToken.UserAgent)
		}
	}

	if !userToken.AuthTokenSeen && userToken.AuthToken == hashedToken {
		userTokenCopy := userToken
		userTokenCopy.AuthTokenSeen = true
		userTokenCopy.SeenAt = now().Unix()
		affectedRows, err := s.SQLStore.NewSession().Where("id = ? AND auth_token = ?", userTokenCopy.Id, userTokenCopy.AuthToken).AllCols().Update(&userTokenCopy)
		if err != nil {
			return nil, err
		}

		if affectedRows == 1 {
			userToken = userTokenCopy
		}

		if affectedRows == 0 {
			s.log.Debug("seen wrong token", "userTokenId", userToken.Id, "userId", userToken.UserId, "authToken", userToken.AuthToken, "clientIP", userToken.ClientIp, "userAgent", userToken.UserAgent)
		} else {
			s.log.Debug("seen token", "userTokenId", userToken.Id, "userId", userToken.UserId, "authToken", userToken.AuthToken, "clientIP", userToken.ClientIp, "userAgent", userToken.UserAgent)
		}
	}

	userToken.UnhashedToken = unhashedToken

	return &userToken, nil
}

func (s *UserAuthTokenService) RefreshToken(token *models.UserAuthToken, clientIP, userAgent string) (bool, error) {
	if token == nil {
		return false, nil
	}

	needsRotation := false
	rotatedAt := time.Unix(token.RotatedAt, 0)
	if token.AuthTokenSeen {
		needsRotation = rotatedAt.Before(now().Add(-RotateTime))
	} else {
		needsRotation = rotatedAt.Before(now().Add(-UrgentRotateTime))
	}

	s.log.Debug("refresh token", "needs rotation?", needsRotation, "auth_token_seen", token.AuthTokenSeen, "rotated_at", rotatedAt, "token.Id", token.Id)
	if !needsRotation {
		return false, nil
	}

	clientIP = util.ParseIPAddress(clientIP)
	newToken, _ := util.RandomHex(16)
	hashedToken := hashToken(newToken)

	sql := `
		UPDATE user_auth_token
		SET
			auth_token_seen = false,
			seen_at = null,
			user_agent = ?,
			client_ip = ?,
			prev_auth_token = case when auth_token_seen then auth_token else prev_auth_token end,
			auth_token = ?,
			rotated_at = ?
		WHERE id = ? AND (auth_token_seen or rotated_at < ?)`

	res, err := s.SQLStore.NewSession().Exec(sql, userAgent, clientIP, hashedToken, now().Unix(), token.Id, now().Add(-UrgentRotateTime))
	if err != nil {
		return false, err
	}

	affected, _ := res.RowsAffected()
	s.log.Debug("rotated", "affected", affected, "auth_token_id", token.Id, "userId", token.UserId, "user_agent", userAgent, "client_ip", clientIP)
	if affected > 0 {
		token.UnhashedToken = newToken
		return true, nil
	}

	return false, nil
}

func hashToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token + setting.SecretKey))
	return hex.EncodeToString(hashBytes[:])
}
