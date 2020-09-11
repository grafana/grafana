package oauthtoken

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

func GetCurrentOAuthToken(ctx context.Context, user models.SignedInUser) (*oauth2.Token, error) {
	authInfoQuery := &models.GetAuthInfoQuery{UserId: user.UserId}
	if err := bus.Dispatch(authInfoQuery); err != nil {
		return nil, fmt.Errorf("Error fetching OAuth information for userid=%d username=%s error=%s", user.UserId, user.Login, err)
	}

	authProvider := authInfoQuery.Result.AuthModule
	connect, err := social.GetConnector(authProvider)
	if err != nil {
		return nil, fmt.Errorf("Failed to get OAuth connector error=%s", err)
	}

	client, err := social.GetOAuthHttpClient(authProvider)
	if err != nil {
		return nil, fmt.Errorf("Failed to create OAuth http client error=%s", err)
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
		return nil, fmt.Errorf("Failed to retrieve access token from OAuth provider=%s userid=%d username=%s error=%s", authInfoQuery.Result.AuthModule, user.UserId, user.Login, err)
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
			return nil, fmt.Errorf("Failed to update auth info during token refresh userId=%d username=%s error=%s", user.UserId, user.Login, err)
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
