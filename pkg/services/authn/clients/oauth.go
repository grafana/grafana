package clients

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	hostedDomainParamName        = "hd"
	codeVerifierParamName        = "code_verifier"
	codeChallengeParamName       = "code_challenge"
	codeChallengeMethodParamName = "code_challenge_method"
	codeChallengeMethod          = "S256"

	oauthStateQueryName          = "state"
	oauthStateCookieName         = "oauth_state"
	oauthPKCECookieName          = "oauth_code_verifier"
	oauthPostLogoutRedirectParam = "post_logout_redirect_uri"
)

var (
	errOAuthClientDisabled = errutil.BadRequest("auth.oauth.disabled", errutil.WithPublicMessage("OAuth client is disabled"))
	errOAuthInternal       = errutil.Internal("auth.oauth.internal", errutil.WithPublicMessage("An internal error occurred in the OAuth client"))

	errOAuthGenPKCE     = errutil.Internal("auth.oauth.pkce.internal", errutil.WithPublicMessage("An internal error occurred"))
	errOAuthMissingPKCE = errutil.BadRequest("auth.oauth.pkce.missing", errutil.WithPublicMessage("Missing required pkce cookie"))

	errOAuthGenState     = errutil.Internal("auth.oauth.state.internal", errutil.WithPublicMessage("An internal error occurred"))
	errOAuthMissingState = errutil.BadRequest("auth.oauth.state.missing", errutil.WithPublicMessage("Missing saved oauth state"))
	errOAuthInvalidState = errutil.Unauthorized("auth.oauth.state.invalid", errutil.WithPublicMessage("Provided state does not match stored state"))

	errOAuthTokenExchange = errutil.Internal("auth.oauth.token.exchange", errutil.WithPublicMessage("Failed to get token from provider"))
	errOAuthUserInfo      = errutil.Internal("auth.oauth.userinfo.error")

	errOAuthMissingRequiredEmail = errutil.Unauthorized("auth.oauth.email.missing", errutil.WithPublicMessage("Provider didn't return an email address"))
	errOAuthEmailNotAllowed      = errutil.Unauthorized("auth.oauth.email.not-allowed", errutil.WithPublicMessage("Required email domain not fulfilled"))
)

func fromSocialErr(err *connectors.SocialError) error {
	return errutil.Unauthorized("auth.oauth.userinfo.failed", errutil.WithPublicMessage(err.Error())).Errorf("%w", err)
}

var (
	_ authn.LogoutClient           = new(OAuth)
	_ authn.RedirectClient         = new(OAuth)
	_ authn.SSOSettingsAwareClient = new(OAuth)
)

func ProvideOAuth(
	name string, cfg *setting.Cfg, oauthService oauthtoken.OAuthTokenService,
	socialService social.Service, settingsProviderService setting.Provider, features featuremgmt.FeatureToggles,
) *OAuth {
	providerName := strings.TrimPrefix(name, "auth.client.")
	return &OAuth{
		name, fmt.Sprintf("oauth_%s", providerName), providerName,
		log.New(name), cfg, settingsProviderService, oauthService, socialService, features,
	}
}

type OAuth struct {
	name         string
	moduleName   string
	providerName string
	log          log.Logger
	cfg          *setting.Cfg

	settingsProviderSvc setting.Provider
	oauthService        oauthtoken.OAuthTokenService
	socialService       social.Service
	features            featuremgmt.FeatureToggles
}

func (c *OAuth) Name() string {
	return c.name
}

func (c *OAuth) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	r.SetMeta(authn.MetaKeyAuthModule, c.moduleName)

	oauthCfg := c.socialService.GetOAuthInfoProvider(c.providerName)
	if !oauthCfg.Enabled {
		return nil, errOAuthClientDisabled.Errorf("oauth client is disabled: %s", c.providerName)
	}

	// get hashed state stored in cookie
	stateCookie, err := r.HTTPRequest.Cookie(oauthStateCookieName)
	if err != nil {
		return nil, errOAuthMissingState.Errorf("missing state cookie")
	}

	if stateCookie.Value == "" {
		return nil, errOAuthMissingState.Errorf("missing state value in state cookie")
	}

	// get state returned by the idp and hash it
	stateQuery := hashOAuthState(r.HTTPRequest.URL.Query().Get(oauthStateQueryName), c.cfg.SecretKey, oauthCfg.ClientSecret)
	// compare the state returned by idp against the one we stored in cookie
	if stateQuery != stateCookie.Value {
		return nil, errOAuthInvalidState.Errorf("provided state did not match stored state")
	}

	var opts []oauth2.AuthCodeOption
	// if pkce is enabled for client validate we have the cookie and set it as url param
	if oauthCfg.UsePKCE {
		pkceCookie, err := r.HTTPRequest.Cookie(oauthPKCECookieName)
		if err != nil {
			return nil, errOAuthMissingPKCE.Errorf("no pkce cookie found: %w", err)
		}
		opts = append(opts, oauth2.VerifierOption(pkceCookie.Value))
	}

	connector, errConnector := c.socialService.GetConnector(c.providerName)
	httpClient, errHTTPClient := c.socialService.GetOAuthHttpClient(c.providerName)
	if errConnector != nil || errHTTPClient != nil {
		return nil, errOAuthInternal.Errorf("failed to get %s oauth client: %w", c.name, errors.Join(errConnector, errHTTPClient))
	}

	clientCtx := context.WithValue(ctx, oauth2.HTTPClient, httpClient)
	// exchange auth code to a valid token
	token, err := connector.Exchange(clientCtx, r.HTTPRequest.URL.Query().Get("code"), opts...)
	if err != nil {
		return nil, errOAuthTokenExchange.Errorf("failed to exchange code to token: %w", err)
	}
	token.TokenType = "Bearer"

	userInfo, err := connector.UserInfo(ctx, connector.Client(clientCtx, token), token)
	if err != nil {
		var sErr *connectors.SocialError
		if errors.As(err, &sErr) {
			return nil, fromSocialErr(sErr)
		}
		return nil, errOAuthUserInfo.Errorf("failed to get user info: %w", err)
	}

	if userInfo.Id == "" {
		if c.features.IsEnabledGlobally(featuremgmt.FlagOauthRequireSubClaim) {
			return nil, errOAuthUserInfo.Errorf("missing required sub claims")
		} else {
			c.log.FromContext(ctx).Warn("Missing sub claim, oauth authentication without a sub claim is deprecated and will be rejected in future versions.")
		}
	}

	if userInfo.Email == "" {
		return nil, errOAuthMissingRequiredEmail.Errorf("required attribute email was not provided")
	}

	if !connector.IsEmailAllowed(userInfo.Email) {
		return nil, errOAuthEmailNotAllowed.Errorf("provided email is not allowed")
	}

	lookupParams := login.UserLookupParams{}
	allowInsecureEmailLookup := c.settingsProviderSvc.KeyValue("auth", "oauth_allow_insecure_email_lookup").MustBool(false)
	if allowInsecureEmailLookup {
		lookupParams.Email = &userInfo.Email
	}

	return &authn.Identity{
		Login:           userInfo.Login,
		Name:            userInfo.Name,
		Email:           userInfo.Email,
		IsGrafanaAdmin:  userInfo.IsGrafanaAdmin,
		AuthenticatedBy: c.moduleName,
		AuthID:          userInfo.Id,
		Groups:          userInfo.Groups,
		OAuthToken:      token,
		OrgRoles:        userInfo.OrgRoles,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			SyncTeams:       true,
			FetchSyncedUser: true,
			SyncPermissions: true,
			AllowSignUp:     connector.IsSignupAllowed(),
			// skip org role flag is checked and handled in the connector. For now we can skip the hook if no roles are passed
			SyncOrgRoles: len(userInfo.OrgRoles) > 0,
			LookUpParams: lookupParams,
		},
	}, nil
}

func (c *OAuth) IsEnabled() bool {
	provider := c.socialService.GetOAuthInfoProvider(c.providerName)
	if provider == nil {
		return false
	}

	return provider.Enabled
}

func (c *OAuth) GetConfig() authn.SSOClientConfig {
	provider := c.socialService.GetOAuthInfoProvider(c.providerName)
	if provider == nil {
		return nil
	}

	return provider
}

func (c *OAuth) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	var opts []oauth2.AuthCodeOption

	oauthCfg := c.socialService.GetOAuthInfoProvider(c.providerName)
	if !oauthCfg.Enabled {
		return nil, errOAuthClientDisabled.Errorf("oauth client is disabled: %s", c.providerName)
	}

	if oauthCfg.HostedDomain != "" {
		opts = append(opts, oauth2.SetAuthURLParam(hostedDomainParamName, oauthCfg.HostedDomain))
	}

	var plainPKCE string
	if oauthCfg.UsePKCE {
		verifier, err := genPKCECodeVerifier()
		if err != nil {
			return nil, errOAuthGenPKCE.Errorf("failed to generate pkce: %w", err)
		}

		plainPKCE = verifier
		opts = append(opts, oauth2.S256ChallengeOption(plainPKCE))
	}

	state, hashedSate, err := genOAuthState(c.cfg.SecretKey, oauthCfg.ClientSecret)
	if err != nil {
		return nil, errOAuthGenState.Errorf("failed to generate state: %w", err)
	}

	connector, err := c.socialService.GetConnector(c.providerName)
	if err != nil {
		return nil, errOAuthInternal.Errorf("failed to get %s oauth connector: %w", c.name, err)
	}

	return &authn.Redirect{
		URL: connector.AuthCodeURL(state, opts...),
		Extra: map[string]string{
			authn.KeyOAuthState: hashedSate,
			authn.KeyOAuthPKCE:  plainPKCE,
		},
	}, nil
}

func (c *OAuth) Logout(ctx context.Context, user identity.Requester) (*authn.Redirect, bool) {
	token := c.oauthService.GetCurrentOAuthToken(ctx, user)

	userID, err := identity.UserIdentifier(user.GetID())
	if err != nil {
		c.log.FromContext(ctx).Error("Failed to parse user id", "id", user.GetID(), "error", err)
		return nil, false
	}

	if err := c.oauthService.InvalidateOAuthTokens(ctx, &login.UserAuth{
		UserId:     userID,
		AuthId:     user.GetAuthID(),
		AuthModule: user.GetAuthenticatedBy(),
	}); err != nil {
		c.log.FromContext(ctx).Error("Failed to invalidate tokens", "id", user.GetID(), "error", err)
	}

	oauthCfg := c.socialService.GetOAuthInfoProvider(c.providerName)
	if !oauthCfg.Enabled {
		c.log.FromContext(ctx).Debug("OAuth client is disabled")
		return nil, false
	}

	redirectURL := getOAuthSignoutRedirectURL(c.cfg, oauthCfg)
	if redirectURL == "" {
		c.log.FromContext(ctx).Debug("No signout redirect url configured")
		return nil, false
	}

	if isOIDCLogout(redirectURL) && token != nil && token.Valid() {
		if idToken, ok := token.Extra("id_token").(string); ok {
			redirectURL = withIDTokenHint(redirectURL, idToken)
		}
	}

	return &authn.Redirect{URL: redirectURL}, true
}

// genPKCECodeVerifier returns code verifier that 128 characters random URL-friendly string.
func genPKCECodeVerifier() (string, error) {
	// IETF RFC 7636 specifies that the code verifier should be 43-128
	// characters from a set of unreserved URI characters which is
	// almost the same as the set of characters in base64url.
	// https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
	//
	// It doesn't hurt to generate a few more bytes here, we generate
	// 96 bytes which we then encode using base64url to make sure
	// they're within the set of unreserved characters.
	//
	// 96 is chosen because 96*8/6 = 128, which means that we'll have
	// 128 characters after it has been base64 encoded.
	raw := make([]byte, 96)
	_, err := rand.Read(raw)
	if err != nil {
		return "", err
	}
	ascii := make([]byte, 128)
	base64.RawURLEncoding.Encode(ascii, raw)

	return string(ascii), nil
}

func genOAuthState(secret, seed string) (string, string, error) {
	rnd := make([]byte, 32)
	if _, err := rand.Read(rnd); err != nil {
		return "", "", err
	}
	state := base64.URLEncoding.EncodeToString(rnd)
	return state, hashOAuthState(state, secret, seed), nil
}

func hashOAuthState(state, secret, seed string) string {
	hashBytes := sha256.Sum256([]byte(state + secret + seed))
	return hex.EncodeToString(hashBytes[:])
}

func getOAuthSignoutRedirectURL(cfg *setting.Cfg, oauthCfg *social.OAuthInfo) string {
	if oauthCfg.SignoutRedirectUrl != "" {
		return oauthCfg.SignoutRedirectUrl
	}

	return cfg.SignoutRedirectUrl
}

func withIDTokenHint(redirectURL string, idToken string) string {
	if idToken == "" {
		return redirectURL
	}

	u, err := url.Parse(redirectURL)
	if err != nil {
		return redirectURL
	}

	q := u.Query()
	q.Set("id_token_hint", idToken)
	u.RawQuery = q.Encode()

	return u.String()
}

func isOIDCLogout(redirectUrl string) bool {
	if redirectUrl == "" {
		return false
	}

	u, err := url.Parse(redirectUrl)
	if err != nil {
		return false
	}

	q := u.Query()
	_, ok := q[oauthPostLogoutRedirectParam]
	return ok
}
