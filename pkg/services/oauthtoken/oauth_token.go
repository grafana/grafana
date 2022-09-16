package oauthtoken

import (
	"context"
	"errors"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger = log.New("oauthtoken")
)

type Service struct {
	SocialService   social.Service
	AuthInfoService login.AuthInfoService
}

type OAuthTokenService interface {
	GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token
	IsOAuthPassThruEnabled(*datasources.DataSource) bool
}

func ProvideService(socialService social.Service, authInfoService login.AuthInfoService) *Service {
	return &Service{
		SocialService:   socialService,
		AuthInfoService: authInfoService,
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

	authProvider := authInfoQuery.Result.AuthModule
	connect, err := o.SocialService.GetConnector(authProvider)
	if err != nil {
		logger.Error("failed to get OAuth connector", "provider", authProvider, "error", err)
		return nil
	}

	client, err := o.SocialService.GetOAuthHttpClient(authProvider)
	if err != nil {
		logger.Error("failed to get OAuth http client", "provider", authProvider, "error", err)
		return nil
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	persistedToken := &oauth2.Token{
		AccessToken:  authInfoQuery.Result.OAuthAccessToken,
		Expiry:       authInfoQuery.Result.OAuthExpiry,
		RefreshToken: authInfoQuery.Result.OAuthRefreshToken,
		TokenType:    authInfoQuery.Result.OAuthTokenType,
	}

	if authInfoQuery.Result.OAuthIdToken != "" {
		persistedToken = persistedToken.WithExtra(map[string]interface{}{"id_token": authInfoQuery.Result.OAuthIdToken})
	}

	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	if err != nil {
		logger.Error("failed to retrieve OAuth access token", "provider", authInfoQuery.Result.AuthModule, "userId", usr.UserID, "username", usr.Login, "error", err)
		return nil
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &models.UpdateAuthInfoCommand{
			UserId:     authInfoQuery.Result.UserId,
			AuthModule: authInfoQuery.Result.AuthModule,
			AuthId:     authInfoQuery.Result.AuthId,
			OAuthToken: token,
		}
		if err := o.AuthInfoService.UpdateAuthInfo(ctx, updateAuthCommand); err != nil {
			logger.Error("failed to update auth info during token refresh", "userId", usr.UserID, "username", usr.Login, "error", err)
			return nil
		}
		logger.Debug("updated OAuth info for user", "userId", usr.UserID, "username", usr.Login)
	}
	return token
}

// IsOAuthPassThruEnabled returns true if Forward OAuth Identity (oauthPassThru) is enabled for the provided data source.
func (o *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get("oauthPassThru").MustBool()
}

// tokensEq checks for OAuth2 token equivalence given the fields of the struct Grafana is interested in
func tokensEq(t1, t2 *oauth2.Token) bool {
	return t1.AccessToken == t2.AccessToken &&
		t1.RefreshToken == t2.RefreshToken &&
		t1.Expiry.Equal(t2.Expiry) &&
		t1.TokenType == t2.TokenType
}
