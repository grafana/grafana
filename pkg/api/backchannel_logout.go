package api

import (
	"context"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
)

const (
	// backChannelLogoutEventType is the required event type for OIDC back-channel logout
	backChannelLogoutEventType = "http://schemas.openid.net/event/backchannel-logout"

	// logoutTokenParam is the form parameter name for the logout token
	logoutTokenParam = "logout_token"
)

// BackChannelLogoutToken represents the structure of an OIDC logout token
// as specified in https://openid.net/specs/openid-connect-backchannel-1_0.html#LogoutToken
type BackChannelLogoutToken struct {
	Issuer    string                 `json:"iss"`
	Subject   string                 `json:"sub,omitempty"`
	Audience  jwt.ClaimStrings       `json:"aud"`
	IssuedAt  *jwt.NumericDate       `json:"iat"`
	ExpiresAt *jwt.NumericDate       `json:"exp"`
	JWTID     string                 `json:"jti"`
	SessionID string                 `json:"sid,omitempty"`
	Events    map[string]interface{} `json:"events"`
	jwt.RegisteredClaims
}

// HandleBackChannelLogout processes OIDC back-channel logout requests
// This endpoint receives logout tokens from OpenID Providers and terminates the corresponding sessions
func (hs *HTTPServer) HandleBackChannelLogout(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()

	// Parse form data (logout token is sent as form data per spec)
	if err := c.Req.ParseForm(); err != nil {
		hs.log.Error("Failed to parse back-channel logout form", "error", err)
		return response.JSON(http.StatusBadRequest, map[string]string{
			"error":             "invalid_request",
			"error_description": "Failed to parse form data",
		})
	}

	logoutTokenString := c.Req.FormValue(logoutTokenParam)
	if logoutTokenString == "" {
		hs.log.Error("Missing logout_token parameter in back-channel logout request")
		return response.JSON(http.StatusBadRequest, map[string]string{
			"error":             "invalid_request",
			"error_description": "Missing logout_token parameter",
		})
	}

	logoutToken, provider, providerName, err := hs.validateLogoutToken(ctx, logoutTokenString)
	if err != nil {
		hs.log.Error("Invalid logout token", "error", err)
		return response.JSON(http.StatusBadRequest, map[string]string{
			"error":             "invalid_request",
			"error_description": err.Error(),
		})
	}

	if err := hs.processBackChannelLogout(ctx, logoutToken, provider, providerName); err != nil {
		hs.log.Error("Failed to process back-channel logout", "error", err, "issuer", logoutToken.Issuer)
		return response.JSON(http.StatusBadRequest, map[string]string{
			"error":             "server_error",
			"error_description": "Failed to process logout request",
		})
	}

	c.Resp.Header().Set("Cache-Control", "no-store")
	return response.Empty(http.StatusOK)
}

// validateLogoutToken validates the logout token according to the OIDC back-channel logout spec
// Section 2.6: https://openid.net/specs/openid-connect-backchannel-1_0.html#Validation
// Returns the validated token, provider info, provider name (connector type), and any error
func (hs *HTTPServer) validateLogoutToken(ctx context.Context, tokenString string) (*BackChannelLogoutToken, *social.OAuthInfo, string, error) {
	parser := jwt.NewParser()
	unverifiedToken, _, err := parser.ParseUnverified(tokenString, &BackChannelLogoutToken{})
	if err != nil {
		return nil, nil, "", fmt.Errorf("failed to parse logout token: %w", err)
	}

	unverifiedClaims, ok := unverifiedToken.Claims.(*BackChannelLogoutToken)
	if !ok {
		return nil, nil, "", errors.New("invalid token claims structure")
	}

	hs.log.Debug("Looking up provider for issuer", "issuer", unverifiedClaims.Issuer)
	provider, providerName := hs.getProviderByIssuer(unverifiedClaims.Issuer)
	if provider == nil {
		hs.log.Error("Provider not found for issuer", "issuer", unverifiedClaims.Issuer)
		return nil, nil, "", fmt.Errorf("unknown issuer: %s", unverifiedClaims.Issuer)
	}

	hs.log.Debug("Found provider", "name", provider.Name, "providerName", providerName, "backChannelLogoutEnabled", provider.BackChannelLogoutEnabled)

	if !provider.BackChannelLogoutEnabled {
		hs.log.Error("Back-channel logout not enabled", "provider", provider.Name)
		return nil, nil, "", fmt.Errorf("back-channel logout not enabled for provider")
	}

	validatedToken, err := jwt.ParseWithClaims(tokenString, &BackChannelLogoutToken{}, func(token *jwt.Token) (interface{}, error) {
		return hs.getSigningKeyForProvider(ctx, provider, token)
	})

	if err != nil {
		return nil, nil, "", fmt.Errorf("token signature validation failed: %w", err)
	}

	claims, ok := validatedToken.Claims.(*BackChannelLogoutToken)
	if !ok || !validatedToken.Valid {
		return nil, nil, "", errors.New("invalid validated token")
	}

	// Perform validation according to spec section 2.6

	if validatedToken.Method.Alg() == "none" {
		return nil, nil, "", errors.New("algorithm 'none' is not allowed for logout tokens")
	}

	if claims.Issuer == "" {
		return nil, nil, "", errors.New("missing required 'iss' claim")
	}
	if len(claims.Audience) == 0 {
		return nil, nil, "", errors.New("missing required 'aud' claim")
	}
	if claims.IssuedAt == nil {
		return nil, nil, "", errors.New("missing required 'iat' claim")
	}
	if claims.ExpiresAt == nil {
		return nil, nil, "", errors.New("missing required 'exp' claim")
	}

	if claims.Subject == "" && claims.SessionID == "" {
		return nil, nil, "", errors.New("logout token must contain either 'sub' or 'sid' claim")
	}

	if claims.Events == nil {
		return nil, nil, "", errors.New("missing required 'events' claim")
	}
	if _, ok := claims.Events[backChannelLogoutEventType]; !ok {
		return nil, nil, "", fmt.Errorf("missing required event type: %s", backChannelLogoutEventType)
	}

	// Step 8 (Optional): Check for JTI replay
	// TODO: Implement JTI tracking to prevent replay attacks

	// Step 9-11 (Optional): Verify iss, sub, sid match expected values
	// This is done during session lookup

	return claims, provider, providerName, nil
}

// processBackChannelLogout performs the actual logout actions by revoking sessions
func (hs *HTTPServer) processBackChannelLogout(ctx context.Context, token *BackChannelLogoutToken, provider *social.OAuthInfo, providerName string) error {
	var sessions []*auth.ExternalSession
	var err error

	if token.SessionID != "" {
		sessions, err = hs.findSessionsBySessionID(ctx, token.SessionID)
		if err != nil {
			hs.log.Warn("Failed to find sessions by session ID", "sid", token.SessionID, "error", err)
		}
	}

	if len(sessions) == 0 && token.Subject != "" {
		sessions, err = hs.findSessionsBySubject(ctx, provider, providerName, token.Subject)
		if err != nil {
			hs.log.Warn("Failed to find sessions by subject", "sub", token.Subject, "error", err)
		}
	}

	if len(sessions) == 0 {
		hs.log.Info("No sessions found for back-channel logout",
			"issuer", token.Issuer,
			"sub", token.Subject,
			"sid", token.SessionID)
		return nil
	}

	revokedCount := 0
	for _, session := range sessions {
		if err := hs.revokeSession(ctx, session); err != nil {
			hs.log.Error("Failed to revoke session during back-channel logout",
				"sessionID", session.ID,
				"userID", session.UserID,
				"error", err)
			continue
		}
		revokedCount++
		hs.log.Info("Successfully revoked session via back-channel logout",
			"userID", session.UserID,
			"sessionID", session.SessionID,
			"issuer", token.Issuer)
	}

	if revokedCount == 0 {
		return errors.New("failed to revoke any sessions")
	}

	hs.log.Info("Back-channel logout completed",
		"issuer", token.Issuer,
		"revokedSessions", revokedCount)

	return nil
}

func (hs *HTTPServer) findSessionsBySessionID(ctx context.Context, sessionID string) ([]*auth.ExternalSession, error) {
	hashedSessionID := hashSessionID(sessionID)

	sessions, err := hs.AuthTokenService.FindExternalSessions(ctx, &auth.ListExternalSessionQuery{
		SessionID: hashedSessionID,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to find sessions by session ID: %w", err)
	}

	return sessions, nil
}

func (hs *HTTPServer) findSessionsBySubject(ctx context.Context, provider *social.OAuthInfo, providerName string, subject string) ([]*auth.ExternalSession, error) {
	authModule := "oauth_" + providerName
	hs.log.Debug("Looking up user by subject", "subject", subject, "authModule", authModule)

	authInfo, err := hs.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
		AuthId:     subject,
		AuthModule: authModule,
	})

	if err != nil {
		hs.log.Warn("Failed to find user by subject", "subject", subject, "authModule", authModule, "error", err)
		return nil, fmt.Errorf("failed to find user by subject: %w", err)
	}

	hs.log.Debug("Found user by subject", "userId", authInfo.UserId)
	sessions, err := hs.AuthTokenService.FindExternalSessions(ctx, &auth.ListExternalSessionQuery{
		UserID: authInfo.UserId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to find sessions for user: %w", err)
	}

	var filteredSessions []*auth.ExternalSession
	for _, session := range sessions {
		if session.AuthModule == authModule {
			filteredSessions = append(filteredSessions, session)
		}
	}

	return filteredSessions, nil
}

func (hs *HTTPServer) revokeSession(ctx context.Context, session *auth.ExternalSession) error {
	userToken, err := hs.AuthTokenService.GetTokenByExternalSessionID(ctx, session.ID)
	if err != nil {
		if errors.Is(err, auth.ErrUserTokenNotFound) {
			hs.log.Debug("No user token found for external session", "sessionID", session.ID)
			return nil
		}
		return fmt.Errorf("failed to get user token for session: %w", err)
	}

	if err := hs.AuthTokenService.RevokeToken(ctx, userToken, false); err != nil {
		return fmt.Errorf("failed to revoke user token: %w", err)
	}

	return nil
}

// getProviderByIssuer finds an OAuth provider configuration by its issuer URL
// Returns the provider info and the provider name (connector type like "generic_oauth")
func (hs *HTTPServer) getProviderByIssuer(issuer string) (*social.OAuthInfo, string) {
	providers := hs.SocialService.GetOAuthInfoProviders()

	hs.log.Debug("Looking for provider", "issuer", issuer, "providerCount", len(providers))

	for name, provider := range providers {
		hs.log.Debug("Checking provider", "name", name, "authUrl", provider.AuthUrl, "tokenUrl", provider.TokenUrl)

		if provider.AuthUrl != "" && strings.HasPrefix(provider.AuthUrl, issuer) {
			hs.log.Debug("Matched on authUrl", "name", name)
			return provider, name
		}

		if provider.TokenUrl != "" && strings.HasPrefix(provider.TokenUrl, issuer) {
			hs.log.Debug("Matched on tokenUrl", "name", name)
			return provider, name
		}
	}

	hs.log.Warn("No provider matched issuer", "issuer", issuer)
	return nil, ""
}

func (hs *HTTPServer) getSigningKeyForProvider(ctx context.Context, provider *social.OAuthInfo, token *jwt.Token) (interface{}, error) {
	kid, ok := token.Header["kid"].(string)
	if !ok {
		return nil, errors.New("missing kid in token header")
	}

	jwks, err := hs.fetchJWKS(ctx, provider)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}

	for _, key := range jwks.Keys {
		if key.Kid == kid {
			return key.PublicKey, nil
		}
	}

	return nil, fmt.Errorf("key with kid %s not found in JWKS", kid)
}

type JWK struct {
	Kid       string `json:"kid"`
	Kty       string `json:"kty"`
	Alg       string `json:"alg"`
	Use       string `json:"use"`
	N         string `json:"n"`
	E         string `json:"e"`
	PublicKey interface{}
}

type JWKS struct {
	Keys []JWK `json:"keys"`
}

func (hs *HTTPServer) fetchJWKS(ctx context.Context, provider *social.OAuthInfo) (*JWKS, error) {
	// Construct JWKS URL from the provider's auth URL
	// Most OIDC providers have a .well-known/openid-configuration endpoint
	// or the JWKS URL can be derived from the issuer

	jwksURL := provider.Extra["jwks_uri"]

	if jwksURL == "" {
		base := ""

		if provider.AuthUrl != "" {
			if u, err := url.Parse(provider.AuthUrl); err == nil {
				// For most OIDC providers, remove the OAuth-specific path segments
				// Examples:
				//   http://keycloak:8080/realms/grafana/protocol/openid-connect/auth
				//   -> http://keycloak:8080/realms/grafana
				//   https://accounts.google.com/o/oauth2/v2/auth
				//   -> https://accounts.google.com
				path := u.Path

				path = strings.TrimSuffix(path, "/authorize")
				path = strings.TrimSuffix(path, "/auth")

				if idx := strings.Index(path, "/protocol/openid-connect"); idx != -1 {
					path = path[:idx]
				} else if idx := strings.Index(path, "/oauth2"); idx != -1 {
					path = path[:idx]
				} else if idx := strings.Index(path, "/oauth"); idx != -1 {
					path = path[:idx]
				}

				base = u.Scheme + "://" + u.Host + path
			}
		}

		if base == "" {
			return nil, errors.New("cannot determine provider base URL for JWKS discovery")
		}

		openidCfgURL := strings.TrimSuffix(base, "/") + "/.well-known/openid-configuration"
		hs.log.Debug("Fetching OpenID configuration for JWKS discovery", "url", openidCfgURL)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, openidCfgURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create openid-configuration request: %w", err)
		}

		httpClient := &http.Client{Timeout: 10 * time.Second}
		resp, err := httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch openid-configuration: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("openid-configuration endpoint returned status %d", resp.StatusCode)
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read openid-configuration response: %w", err)
		}

		var cfg struct {
			JwksURI string `json:"jwks_uri"`
		}
		if err := json.Unmarshal(body, &cfg); err != nil {
			return nil, fmt.Errorf("failed to parse openid-configuration: %w", err)
		}

		if cfg.JwksURI == "" {
			return nil, errors.New("openid-configuration did not contain jwks_uri")
		}

		jwksURL = cfg.JwksURI
	}

	hs.log.Debug("Using JWKS URL", "jwks_url", jwksURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create JWKS request: %w", err)
	}

	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read JWKS response: %w", err)
	}

	var jwks JWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, fmt.Errorf("failed to parse JWKS: %w", err)
	}

	for i := range jwks.Keys {
		key := &jwks.Keys[i]

		// Only support RSA keys for now (most common for OIDC)
		if key.Kty == "RSA" {
			pubKey, err := hs.parseRSAPublicKey(key)
			if err != nil {
				hs.log.Warn("Failed to parse RSA public key", "kid", key.Kid, "error", err)
				continue
			}
			key.PublicKey = pubKey
		} else {
			hs.log.Debug("Unsupported key type", "kty", key.Kty, "kid", key.Kid)
		}
	}

	return &jwks, nil
}

func (hs *HTTPServer) parseRSAPublicKey(key *JWK) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, fmt.Errorf("failed to decode modulus: %w", err)
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, fmt.Errorf("failed to decode exponent: %w", err)
	}

	var eInt int
	for _, b := range eBytes {
		eInt = eInt<<8 | int(b)
	}

	pubKey := &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: eInt,
	}

	return pubKey, nil
}

func hashSessionID(sessionID string) string {
	hash := sha256.Sum256([]byte(sessionID))
	return hex.EncodeToString(hash[:])
}
