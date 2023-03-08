package oauthtoken

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("oauthtoken")
	// ExpiryDelta is used to prevent any issue that is caused by the clock skew (server times can differ slightly between different machines).
	// Shouldn't be more than 30s
	ExpiryDelta            = 10 * time.Second
	ErrNoRefreshTokenFound = errors.New("no refresh token found")
	ErrNotAnOAuthProvider  = errors.New("not an oauth provider")
)

type Service struct {
	Cfg               *setting.Cfg
	SocialService     social.Service
	AuthInfoService   login.AuthInfoService
	singleFlightGroup *singleflight.Group
}

type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
	HasOAuthEntry(context.Context, *user.SignedInUser) (*login.UserAuth, bool, error)
	TryTokenRefresh(context.Context, *login.UserAuth) error
	InvalidateOAuthTokens(context.Context, *login.UserAuth) error
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService, cfg *setting.Cfg) *Service {
	return &Service{
		Cfg:               cfg,
		SocialService:     socialService,
		AuthInfoService:   authInfoService,
		singleFlightGroup: new(singleflight.Group),
	}
}

// GetCurrentOAuthToken returns the OAuth token, if any, for the authenticated user. Will try to refresh the token if it has expired.
func (o *Service) GetCurrentOAuthToken(ctx context.Context, usr *user.SignedInUser) *oauth2.Token {
	if usr == nil {
		// No user, therefore no token
		return nil
	}

	authInfoQuery := &login.GetAuthInfoQuery{UserId: usr.UserID}
	if err := o.AuthInfoService.GetAuthInfo(ctx, authInfoQuery); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			// Not necessarily an error.  User may be logged in another way.
			logger.Debug("no oauth token for user found", "userId", usr.UserID, "username", usr.Login)
		} else {
			logger.Error("failed to get oauth token for user", "userId", usr.UserID, "username", usr.Login, "error", err)
		}
		return nil
	}

	token, err := o.tryGetOrRefreshAccessToken(ctx, authInfoQuery.Result)
	if err != nil {
		if errors.Is(err, ErrNoRefreshTokenFound) {
			return buildOAuthTokenFromAuthInfo(authInfoQuery.Result)
		}

		return nil
	}

	return token
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func (o *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return IsOAuthPassThruEnabled(ds)
}

// HasOAuthEntry returns true and the UserAuth object when OAuth info exists for the specified User
func (o *Service) HasOAuthEntry(ctx context.Context, usr *user.SignedInUser) (*login.UserAuth, bool, error) {
	if usr == nil {
		// No user, therefore no token
		return nil, false, nil
	}

	authInfoQuery := &login.GetAuthInfoQuery{UserId: usr.UserID}
	err := o.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			// Not necessarily an error.  User may be logged in another way.
			return nil, false, nil
		}
		logger.Error("failed to fetch oauth token for user", "userId", usr.UserID, "username", usr.Login, "error", err)
		return nil, false, err
	}
	if !strings.Contains(authInfoQuery.Result.AuthModule, "oauth") {
		return nil, false, nil
	}
	return authInfoQuery.Result, true, nil
}

// TryTokenRefresh returns an error in case the OAuth token refresh was unsuccessful
// It uses a singleflight.Group to prevent getting the Refresh Token multiple times for a given User
func (o *Service) TryTokenRefresh(ctx context.Context, usr *login.UserAuth) error {
	lockKey := fmt.Sprintf("oauth-refresh-token-%d", usr.UserId)
	_, err, _ := o.singleFlightGroup.Do(lockKey, func() (interface{}, error) {
		logger.Debug("singleflight request for getting a new access token", "key", lockKey)

		return o.tryGetOrRefreshAccessToken(ctx, usr)
	})
	return err
}

func buildOAuthTokenFromAuthInfo(authInfo *login.UserAuth) *oauth2.Token {
	token := &oauth2.Token{
		AccessToken:  authInfo.OAuthAccessToken,
		Expiry:       authInfo.OAuthExpiry,
		RefreshToken: authInfo.OAuthRefreshToken,
		TokenType:    authInfo.OAuthTokenType,
	}

	if authInfo.OAuthIdToken != "" {
		token = token.WithExtra(map[string]interface{}{"id_token": authInfo.OAuthIdToken})
	}

	return token
}

func checkOAuthRefreshToken(authInfo *login.UserAuth) error {
	if !strings.Contains(authInfo.AuthModule, "oauth") {
		logger.Warn("the specified user's auth provider is not oauth",
			"authmodule", authInfo.AuthModule, "userid", authInfo.UserId)
		return ErrNotAnOAuthProvider
	}

	if authInfo.OAuthRefreshToken == "" {
		logger.Debug("no refresh token available",
			"authmodule", authInfo.AuthModule, "userid", authInfo.UserId)
		return ErrNoRefreshTokenFound
	}

	return nil
}

// InvalidateOAuthTokens invalidates the OAuth tokens (access_token, refresh_token) and sets the Expiry to default/zero
func (o *Service) InvalidateOAuthTokens(ctx context.Context, usr *login.UserAuth) error {
	return o.AuthInfoService.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
		UserId:     usr.UserId,
		AuthModule: usr.AuthModule,
		AuthId:     usr.AuthId,
		OAuthToken: &oauth2.Token{
			AccessToken:  "",
			RefreshToken: "",
			Expiry:       time.Time{},
		},
	})
}

func (o *Service) tryGetOrRefreshAccessToken(ctx context.Context, usr *login.UserAuth) (*oauth2.Token, error) {
	if err := checkOAuthRefreshToken(usr); err != nil {
		return nil, err
	}

	authProvider := usr.AuthModule
	connect, err := o.SocialService.GetConnector(authProvider)
	if err != nil {
		logger.Error("failed to get oauth connector", "provider", authProvider, "error", err)
		return nil, err
	}

	client, err := o.SocialService.GetOAuthHttpClient(authProvider)
	if err != nil {
		logger.Error("failed to get oauth http client", "provider", authProvider, "error", err)
		return nil, err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	persistedToken := buildOAuthTokenFromAuthInfo(usr)

	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	if err != nil {
		logger.Error("failed to retrieve oauth access token",
			"provider", usr.AuthModule, "userId", usr.UserId, "error", err)
		return nil, err
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &login.UpdateAuthInfoCommand{
			UserId:     usr.UserId,
			AuthModule: usr.AuthModule,
			AuthId:     usr.AuthId,
			OAuthToken: token,
		}

		if o.Cfg.Env == setting.Dev {
			logger.Debug("oauth got token",
				"user", usr.UserId,
				"auth_module", usr.AuthModule,
				"expiry", fmt.Sprintf("%v", token.Expiry),
				"access_token", fmt.Sprintf("%v", token.AccessToken),
				"refresh_token", fmt.Sprintf("%v", token.RefreshToken),
			)
		}

		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			logger.Error("failed to update auth info during token refresh", "userId", usr.UserId, "error", err)
			return nil, err
		}
		logger.Debug("updated oauth info for user", "userId", usr.UserId)
	}

	return token, nil
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get("oauthPassThru").MustBool()
}

// tokensEq checks for OAuth2 token equivalence given the fields of the struct Grafana is interested in
func tokensEq(t1, t2 *oauth2.Token) bool {
	return t1.AccessToken == t2.AccessToken &&
		t1.RefreshToken == t2.RefreshToken &&
		t1.Expiry.Equal(t2.Expiry) &&
		t1.TokenType == t2.TokenType
}
