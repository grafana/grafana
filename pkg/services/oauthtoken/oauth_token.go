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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger      = log.New("oauthtoken")
	ExpiryDelta = 10 * time.Second
)

type Service struct {
	SocialService     social.Service
	AuthInfoService   login.AuthInfoService
	singleFlightGroup *singleflight.Group
}

type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
	HasOAuthEntry(context.Context, *user.SignedInUser) (bool, *models.UserAuth)
	TryTokenRefresh(ctx context.Context, usr *models.UserAuth) error
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService) *Service {
	return &Service{
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

	authInfoQuery := &models.GetAuthInfoQuery{UserId: usr.UserID}
	if err := o.AuthInfoService.GetAuthInfo(ctx, authInfoQuery); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			// Not necessarily an error.  User may be logged in another way.
			logger.Debug("no OAuth token for user found", "userId", usr.UserID, "username", usr.Login)
		} else {
			logger.Error("failed to get OAuth token for user", "userId", usr.UserID, "username", usr.Login, "error", err)
		}
		return nil
	}

	token, err := o.tryGetOrRefreshAccessToken(ctx, authInfoQuery.Result)
	if err != nil {
		return nil
	}
	return token
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func (o *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get("oauthPassThru").MustBool()
}

// HasOAuthEntry returns true and the UserAuth object when OAuth info exists for the specified User
func (o *Service) HasOAuthEntry(ctx context.Context, usr *user.SignedInUser) (bool, *models.UserAuth) {
	if usr == nil {
		// No user, therefore no token
		return false, nil
	}

	authInfoQuery := &models.GetAuthInfoQuery{UserId: usr.UserID}
	err := o.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)
	if err != nil {
		if !errors.Is(err, user.ErrUserNotFound) {
			logger.Error("failed to get OAuth token for user", "userId", usr.UserID, "username", usr.Login, "error", err)
		}
		return false, nil
	}
	if !strings.Contains(authInfoQuery.Result.AuthModule, "oauth") {
		return false, nil
	}
	return true, authInfoQuery.Result
}

// TryTokenRefresh returns an error in case the OAuth token refresh was unsuccessful
// It uses a singleflight.Group to prevent getting the Refresh Token multiple times for a given User
func (o *Service) TryTokenRefresh(ctx context.Context, usr *models.UserAuth) error {
	lockKey := fmt.Sprintf("oauth-refresh-token-%d", usr.UserId)
	_, err, _ := o.singleFlightGroup.Do(lockKey, func() (interface{}, error) {
		logger.Debug("singleflight request for getting a new access token", "key", lockKey)
		authProvider := usr.AuthModule

		if !strings.Contains(authProvider, "oauth") {
			logger.Error("the specified User's auth provider is not OAuth", "authmodule", usr.AuthModule, "userid", usr.UserId)
			return nil, errors.New("not an OAuth provider")
		}

		return o.tryGetOrRefreshAccessToken(ctx, usr)
	})
	return err
}

func (o *Service) tryGetOrRefreshAccessToken(ctx context.Context, usr *models.UserAuth) (*oauth2.Token, error) {
	authProvider := usr.AuthModule
	connect, err := o.SocialService.GetConnector(authProvider)
	if err != nil {
		logger.Error("failed to get OAuth connector", "provider", authProvider, "error", err)
		return nil, err
	}

	client, err := o.SocialService.GetOAuthHttpClient(authProvider)
	if err != nil {
		logger.Error("failed to get OAuth http client", "provider", authProvider, "error", err)
		return nil, err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	persistedToken := &oauth2.Token{
		AccessToken:  usr.OAuthAccessToken,
		Expiry:       usr.OAuthExpiry,
		RefreshToken: usr.OAuthRefreshToken,
		TokenType:    usr.OAuthTokenType,
	}

	if usr.OAuthIdToken != "" {
		persistedToken = persistedToken.WithExtra(map[string]interface{}{"id_token": usr.OAuthIdToken})
	}

	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	if err != nil {
		logger.Error("failed to retrieve OAuth access token", "provider", usr.AuthModule, "userId", usr.UserId, "error", err)
		return nil, err
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &models.UpdateAuthInfoCommand{
			UserId:     usr.UserId,
			AuthModule: usr.AuthModule,
			AuthId:     usr.AuthId,
			OAuthToken: token,
		}
		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			logger.Error("failed to update auth info during token refresh", "userId", usr.UserId, "error", err)
			return nil, err
		}
		logger.Debug("updated OAuth info for user", "userId", usr.UserId)
	}
	return token, nil
}

// tokensEq checks for OAuth2 token equivalence given the fields of the struct Grafana is interested in
func tokensEq(t1, t2 *oauth2.Token) bool {
	return t1.AccessToken == t2.AccessToken &&
		t1.RefreshToken == t2.RefreshToken &&
		t1.Expiry.Equal(t2.Expiry) &&
		t1.TokenType == t2.TokenType
}
