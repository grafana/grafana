package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/bus"
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

var (
	getTime          = time.Now
	RotateTime       = 30 * time.Second
	UrgentRotateTime = 10 * time.Second
	oneYearInSeconds = 31557600 //used as default maxage for session cookies. We validate/rotate them more often.
)

// UserAuthTokenService are used for generating and validating user auth tokens
type UserAuthTokenService struct {
	SQLStore          *sqlstore.SqlStore            `inject:""`
	ServerLockService *serverlock.ServerLockService `inject:""`
	log               log.Logger
}

// Init this service
func (s *UserAuthTokenService) Init() error {
	s.log = log.New("auth")
	return nil
}

func (s *UserAuthTokenService) InitContextWithToken(ctx *models.ReqContext, orgID int64) bool {
	//auth User
	unhashedToken := ctx.GetCookie(setting.SessionOptions.CookieName)
	if unhashedToken == "" {
		return false
	}

	user, err := s.LookupToken(unhashedToken)
	if err != nil {
		ctx.Logger.Info("failed to look up user based on cookie", "error", err)
		return false
	}

	query := models.GetSignedInUserQuery{UserId: user.UserId, OrgId: orgID}
	if err := bus.Dispatch(&query); err != nil {
		ctx.Logger.Error("Failed to get user with id", "userId", user.UserId, "error", err)
		return false
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.UserToken = user

	//rotate session token if needed.
	rotated, err := s.RefreshToken(ctx.UserToken, ctx.RemoteAddr(), ctx.Req.UserAgent())
	if err != nil {
		ctx.Logger.Error("failed to rotate token", "error", err, "user.id", user.UserId, "user_token.id", user.Id)
		return true
	}

	if rotated {
		s.writeSessionCookie(ctx, ctx.UserToken.UnhashedToken, oneYearInSeconds)
	}

	return true
}

func (s *UserAuthTokenService) writeSessionCookie(ctx *models.ReqContext, value string, maxAge int) {
	ctx.Logger.Info("new token", "unhashed token", value)

	ctx.Resp.Header().Del("Set-Cookie")
	cookie := http.Cookie{
		Name:     setting.SessionOptions.CookieName,
		Value:    url.QueryEscape(value),
		HttpOnly: true,
		Domain:   setting.Domain,
		Path:     setting.AppSubUrl + "/",
		Secure:   setting.SessionOptions.Secure,
	}

	http.SetCookie(ctx.Resp, &cookie)
}

func (s *UserAuthTokenService) UserAuthenticatedHook(user *models.User, c *models.ReqContext) error {
	userToken, err := s.CreateToken(user.Id, c.RemoteAddr(), c.Req.UserAgent())
	if err != nil {
		return err
	}

	c.UserToken = userToken

	s.writeSessionCookie(c, userToken.UnhashedToken, oneYearInSeconds)
	return nil
}

func (s *UserAuthTokenService) UserSignedOutHook(c *models.ReqContext) {
	s.writeSessionCookie(c, "", -1)
}

func (s *UserAuthTokenService) CreateToken(userId int64, clientIP, userAgent string) (*models.UserAuthToken, error) {
	clientIP = util.ParseIPAddress(clientIP)
	token, err := util.RandomHex(16)
	if err != nil {
		return nil, err
	}

	hashedToken := hashToken(token)

	now := getTime().Unix()

	userToken := models.UserAuthToken{
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
	_, err = s.SQLStore.NewSession().Insert(&userToken)
	if err != nil {
		return nil, err
	}

	userToken.UnhashedToken = token

	return &userToken, nil
}

func (s *UserAuthTokenService) LookupToken(unhashedToken string) (*models.UserAuthToken, error) {
	hashedToken := hashToken(unhashedToken)
	expireBefore := getTime().Add(time.Duration(-86400*setting.LogInRememberDays) * time.Second).Unix()

	var userToken models.UserAuthToken
	exists, err := s.SQLStore.NewSession().Where("(auth_token = ? OR prev_auth_token = ?) AND created_at > ?", hashedToken, hashedToken, expireBefore).Get(&userToken)
	if err != nil {
		return nil, err
	}

	if !exists {
		return nil, ErrAuthTokenNotFound
	}

	if userToken.AuthToken != hashedToken && userToken.PrevAuthToken == hashedToken && userToken.AuthTokenSeen {
		userTokenCopy := userToken
		userTokenCopy.AuthTokenSeen = false
		expireBefore := getTime().Add(-UrgentRotateTime).Unix()
		affectedRows, err := s.SQLStore.NewSession().Where("id = ? AND prev_auth_token = ? AND rotated_at < ?", userTokenCopy.Id, userTokenCopy.PrevAuthToken, expireBefore).AllCols().Update(&userTokenCopy)
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
		userTokenCopy.SeenAt = getTime().Unix()
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

	now := getTime()

	needsRotation := false
	rotatedAt := time.Unix(token.RotatedAt, 0)
	if token.AuthTokenSeen {
		needsRotation = rotatedAt.Before(now.Add(-RotateTime))
	} else {
		needsRotation = rotatedAt.Before(now.Add(-UrgentRotateTime))
	}

	if !needsRotation {
		return false, nil
	}

	s.log.Debug("refresh token needs rotation?", "auth_token_seen", token.AuthTokenSeen, "rotated_at", rotatedAt, "token.Id", token.Id)

	clientIP = util.ParseIPAddress(clientIP)
	newToken, _ := util.RandomHex(16)
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

	res, err := s.SQLStore.NewSession().Exec(sql, userAgent, clientIP, s.SQLStore.Dialect.BooleanStr(true), hashedToken, s.SQLStore.Dialect.BooleanStr(false), now.Unix(), token.Id, s.SQLStore.Dialect.BooleanStr(true), now.Add(-30*time.Second).Unix())
	if err != nil {
		return false, err
	}

	affected, _ := res.RowsAffected()
	s.log.Debug("rotated", "affected", affected, "auth_token_id", token.Id, "userId", token.UserId)
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
