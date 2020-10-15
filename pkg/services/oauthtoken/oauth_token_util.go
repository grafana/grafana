package oauthtoken

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

var (
	logger = log.New("oauthtoken")
)

func GetCurrentOAuthToken(ctx context.Context, user *models.SignedInUser) (*oauth2.Token, error) {
	if user == nil {
		// No user, therefore no token
		return nil, nil
	}

	authInfoQuery := &models.GetAuthInfoQuery{UserId: user.UserId}
	if err := bus.Dispatch(authInfoQuery); err != nil {
		if err == models.ErrUserNotFound {
			// Not necessarily an error.  User may be logged in another way.
			logger.Debug("No oauth token for user", "userid", user.UserId, "username", user.Login)
		} else {
			logger.Error("Error getting oauth token for user", "userid", user.UserId, "username", user.Login, "error", err)
		}
		return nil, nil
	}

	authProvider := authInfoQuery.Result.AuthModule
	connect, err := social.GetConnector(authProvider)
	if err != nil {
		logger.Error("failed to get OAuth connector", "error", err)
		return nil, errors.New("failed to retrieve OAuth token")
	}

	client, err := social.GetOAuthHttpClient(authProvider)
	if err != nil {
		logger.Error("failed to create OAuth http client", "error", err)
		return nil, errors.New("failed to retrieve OAuth token")
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, client)

	persistedToken := &oauth2.Token{
		AccessToken:  authInfoQuery.Result.OAuthAccessToken,
		Expiry:       authInfoQuery.Result.OAuthExpiry,
		RefreshToken: authInfoQuery.Result.OAuthRefreshToken,
		TokenType:    authInfoQuery.Result.OAuthTokenType,
	}
	// TokenSource handles refreshing the token if it has expired
	token, err := connect.TokenSource(ctx, persistedToken).Token()
	if err != nil {
		logger.Error("failed to retrieve access token from OAuth", "provider", authInfoQuery.Result.AuthModule, "userid", user.UserId, "username", user.Login, "error", err)
		return nil, errors.New("failed to retrieve OAuth token")
	}

	// If the tokens are not the same, update the entry in the DB
	if !tokensEq(persistedToken, token) {
		updateAuthCommand := &models.UpdateAuthInfoCommand{
			UserId:     authInfoQuery.Result.UserId,
			AuthModule: authInfoQuery.Result.AuthModule,
			AuthId:     authInfoQuery.Result.AuthId,
			OAuthToken: token,
		}
		if err := bus.Dispatch(updateAuthCommand); err != nil {
			logger.Error("failed to update auth info during token refresh", "userid", user.UserId, "username", user.Login, "error", err)
			return nil, errors.New("failed to retrieve OAuth token")
		}
		logger.Debug("Updated OAuth info while proxying an OAuth pass-thru request", "userid", user.UserId, "username", user.Login)
	}
	return token, nil
}

func IsOAuthPassThruEnabled(ds *models.DataSource) bool {
	return ds.JsonData != nil && ds.JsonData.Get("oauthPassThru").MustBool()
}

// tokensEq checks for OAuth2 token equivalence given the fields of the struct Grafana is interested in
func tokensEq(t1, t2 *oauth2.Token) bool {
	return t1.AccessToken == t2.AccessToken &&
		t1.RefreshToken == t2.RefreshToken &&
		t1.Expiry == t2.Expiry &&
		t1.TokenType == t2.TokenType
}
