package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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

var now = time.Now

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
		Value:    url.QueryEscape(userToken.unhashedToken),
		HttpOnly: true,
		Expires:  time.Now().Add(time.Minute * 10),
		Domain:   setting.Domain,
	}

	c.Resp.Header().Add("Set-Cookie", cookie.String())

	return nil
}

func (s *UserAuthTokenService) UserSignedOutHook(c *models.ReqContext) {
	c.SetCookie(sessionCookieKey, "", -1, setting.AppSubUrl+"/", setting.Domain, false, true)
}

// func (s *UserAuthTokenService) RequestMiddleware() macaron.Handler {
// 	return func(ctx *models.ReqContext) {
// 		authToken := ctx.GetCookie(sessionCookieKey)
// 		userToken, err := s.LookupToken(authToken)
// 		if err != nil {

// 		}

// 		ctx.Next()

// 		refreshed, err := s.RefreshToken(userToken, ctx.RemoteAddr(), ctx.Req.UserAgent())
// 		if err != nil {

// 		}

// 		if refreshed {
// 			ctx.Resp.Header().Del("Set-Cookie")
// 			ctx.SetCookie(sessionCookieKey, userToken.unhashedToken, setting.AppSubUrl+"/", setting.Domain, false, true)
// 		}
// 	}
// }

func (s *UserAuthTokenService) CreateToken(userId int64, clientIP, userAgent string) (*userAuthToken, error) {
	clientIP = util.ParseIPAddress(clientIP)
	token, err := util.RandomHex(16)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(token)

	userToken := userAuthToken{
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

	userToken.unhashedToken = token

	return &userToken, nil
}

func (s *UserAuthTokenService) LookupToken(ctx *models.ReqContext) (*userAuthToken, error) {
	unhashedToken := ctx.GetCookie(sessionCookieKey)
	if unhashedToken == "" {
		return nil, fmt.Errorf("session token cookie is empty")
	}

	hashedToken := hashToken(unhashedToken)

	var userToken userAuthToken
	exists, err := s.SQLStore.NewSession().Where("auth_token = ? OR prev_auth_token = ?", hashedToken, hashedToken).Get(&userToken)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, ErrAuthTokenNotFound
	}

	if userToken.AuthToken != hashedToken && userToken.PrevAuthToken == hashedToken && userToken.AuthTokenSeen {
		userToken.AuthTokenSeen = false
		expireBefore := now().Add(-1 * time.Minute).Unix()
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

	userToken.unhashedToken = unhashedToken

	return &userToken, nil
}

func (s *UserAuthTokenService) RefreshToken(token *userAuthToken, clientIP, userAgent string) (bool, error) {
	// lookup token in db
	// refresh token if needed

	return false, nil
}

func hashToken(token string) string {
	hashBytes := sha256.Sum256([]byte(token + setting.SecretKey))
	return hex.EncodeToString(hashBytes[:])
}
