package v2

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/gob"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
)

const (
	AccessTokenHeader       = "X-Access-Token"
	renderKeyQueryParameter = "renderKey"
	renderKeyCachePrefix    = "render-%s"
	renderKeyRandomBytes    = 24
	accessTokenBytesMax     = 64 * 1024
)

var ErrAccessTokenInvalid = errors.New("access token header is invalid")

type RenderUser struct {
	OrgID   int64  `json:"org_id"`
	UserID  int64  `json:"user_id"`
	OrgRole string `json:"org_role"`
}

type RenderKey struct {
	value string
}

func ParseRenderKey(value string) (RenderKey, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return RenderKey{}, errors.New("parse render key: value is required")
	}
	return RenderKey{value: value}, nil
}

func (k RenderKey) String() string {
	return k.value
}

type renderKey = RenderKey

type AuthenticationConfiguration struct {
	secret   rendererAuthToken
	lifetime renderKeyLifetime
}

func (c AuthenticationConfiguration) RendererAuthToken() string {
	return c.secret.value
}

func (c AuthenticationConfiguration) RenderKeyLifetime() time.Duration {
	return c.lifetime.duration
}

type AuthorizationRequest struct {
	headers  http.Header
	identity renderIdentity
	secret   rendererAuthToken
	lifetime renderKeyLifetime
}

type authorizationRequest = AuthorizationRequest

func (r AuthorizationRequest) authenticationConfiguration() AuthenticationConfiguration {
	return AuthenticationConfiguration{secret: r.secret, lifetime: r.lifetime}
}

func (r AuthorizationRequest) Headers() http.Header {
	return r.headers.Clone()
}

func (r AuthorizationRequest) User() RenderUser {
	return RenderUser{OrgID: r.identity.orgID, UserID: r.identity.userID, OrgRole: r.identity.orgRole}
}

func (r AuthorizationRequest) RendererAuthToken() string {
	return r.secret.value
}

func (r AuthorizationRequest) RenderKeyLifetime() time.Duration {
	return r.lifetime.duration
}

type CallbackAuthenticator interface {
	Authorize(context.Context, AuthorizationRequest) (CallbackAuthorization, error)
	Authenticate(context.Context, RenderKey, AuthenticationConfiguration) (RenderUser, bool)
}

type callbackAuthorizationKind uint8

const (
	callbackAuthorizationInvalid callbackAuthorizationKind = iota
	callbackAuthorizationRenderKey
	callbackAuthorizationAccessToken
)

type CallbackAuthorization struct {
	kind    callbackAuthorizationKind
	value   string
	release func(context.Context)
}

func newRenderKeyAuthorization(key RenderKey, release func(context.Context)) CallbackAuthorization {
	return CallbackAuthorization{kind: callbackAuthorizationRenderKey, value: key.value, release: release}
}

func newAccessTokenAuthorization(token accessToken) CallbackAuthorization {
	return CallbackAuthorization{kind: callbackAuthorizationAccessToken, value: token.value}
}

func NewRenderKeyCallbackAuthorization(key RenderKey, release func(context.Context)) (CallbackAuthorization, error) {
	if key.value == "" {
		return CallbackAuthorization{}, errors.New("create render key callback authorization: parsed render key is required")
	}
	return newRenderKeyAuthorization(key, release), nil
}

func NewAccessTokenCallbackAuthorization(value string) (CallbackAuthorization, error) {
	token, err := parseAccessToken(http.Header{AccessTokenHeader: {value}})
	if err != nil {
		return CallbackAuthorization{}, err
	}
	return newAccessTokenAuthorization(token), nil
}

func (a CallbackAuthorization) valid() bool {
	return a.kind != callbackAuthorizationInvalid && a.value != ""
}

func (a CallbackAuthorization) apply(query url.Values, headers http.Header) {
	switch a.kind {
	case callbackAuthorizationInvalid:
	case callbackAuthorizationRenderKey:
		query.Set(renderKeyQueryParameter, a.value)
	case callbackAuthorizationAccessToken:
		headers.Set(AccessTokenHeader, a.value)
	}
}

func (a CallbackAuthorization) close(ctx context.Context) {
	if a.release != nil {
		a.release(ctx)
	}
}

type accessToken struct {
	value string
}

func parseAccessToken(headers http.Header) (accessToken, error) {
	values := headers.Values(AccessTokenHeader)
	if len(values) != 1 {
		return accessToken{}, ErrAccessTokenInvalid
	}
	value := strings.TrimSpace(values[0])
	if value == "" || len(value) > accessTokenBytesMax {
		return accessToken{}, ErrAccessTokenInvalid
	}
	return accessToken{value: value}, nil
}

type accessTokenAuthenticator struct{}

// NewAccessTokenAuthenticator forwards X-Access-Token to the renderer request.
// The renderer deployment must propagate that header to its browser callback.
func NewAccessTokenAuthenticator() CallbackAuthenticator {
	return accessTokenAuthenticator{}
}

func (accessTokenAuthenticator) Authorize(_ context.Context, request AuthorizationRequest) (CallbackAuthorization, error) {
	token, err := parseAccessToken(request.headers)
	if err != nil {
		return CallbackAuthorization{}, err
	}
	return newAccessTokenAuthorization(token), nil
}

func (accessTokenAuthenticator) Authenticate(context.Context, RenderKey, AuthenticationConfiguration) (RenderUser, bool) {
	return RenderUser{}, false
}

type renderJWT struct {
	RenderUser *RenderUser
	jwt.RegisteredClaims
}

type jwtRenderKeyAuthenticator struct{}

func NewJWTRenderKeyAuthenticator() CallbackAuthenticator {
	return jwtRenderKeyAuthenticator{}
}

func (jwtRenderKeyAuthenticator) Authorize(_ context.Context, request AuthorizationRequest) (CallbackAuthorization, error) {
	claims := renderJWT{
		RenderUser: &RenderUser{
			OrgID:   request.identity.orgID,
			UserID:  request.identity.userID,
			OrgRole: request.identity.orgRole,
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(request.lifetime.duration)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	value, err := token.SignedString([]byte(request.secret.value))
	if err != nil {
		return CallbackAuthorization{}, fmt.Errorf("sign render key: %w", err)
	}
	return newRenderKeyAuthorization(RenderKey{value: value}, nil), nil
}

func (jwtRenderKeyAuthenticator) Authenticate(_ context.Context, key RenderKey, cfg AuthenticationConfiguration) (RenderUser, bool) {
	if !strings.HasPrefix(key.value, "eyJ") {
		return RenderUser{}, false
	}

	claims := new(renderJWT)
	token, err := jwt.ParseWithClaims(key.value, claims, func(_ *jwt.Token) (any, error) {
		return []byte(cfg.secret.value), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS512.Alg()}))
	if err != nil || !token.Valid || claims.RenderUser == nil {
		return RenderUser{}, false
	}
	return *claims.RenderUser, true
}

type cachedRenderKeyAuthenticator struct {
	store  remotecache.CacheStorage
	logger log.Logger
}

func NewCachedRenderKeyAuthenticator(store remotecache.CacheStorage) (CallbackAuthenticator, error) {
	if store == nil {
		return nil, errors.New("create cached render key authenticator: cache is required")
	}
	return &cachedRenderKeyAuthenticator{store: store, logger: log.New("rendering.v2.auth")}, nil
}

func (a *cachedRenderKeyAuthenticator) Authorize(ctx context.Context, request AuthorizationRequest) (CallbackAuthorization, error) {
	keyBytes := make([]byte, renderKeyRandomBytes)
	if _, err := rand.Read(keyBytes); err != nil {
		return CallbackAuthorization{}, fmt.Errorf("generate render key: %w", err)
	}
	key := RenderKey{value: base64.RawURLEncoding.EncodeToString(keyBytes)}

	var encoded bytes.Buffer
	if err := gob.NewEncoder(&encoded).Encode(&RenderUser{
		OrgID:   request.identity.orgID,
		UserID:  request.identity.userID,
		OrgRole: request.identity.orgRole,
	}); err != nil {
		return CallbackAuthorization{}, fmt.Errorf("encode render user: %w", err)
	}
	cacheKey := fmt.Sprintf(renderKeyCachePrefix, key.value)
	if err := a.store.Set(ctx, cacheKey, encoded.Bytes(), request.lifetime.duration); err != nil {
		return CallbackAuthorization{}, fmt.Errorf("store render key: %w", err)
	}

	return newRenderKeyAuthorization(key, func(releaseCtx context.Context) {
		if err := a.store.Delete(releaseCtx, cacheKey); err != nil {
			a.logger.Error("Failed to delete render key", "error", err)
		}
	}), nil
}

func (a *cachedRenderKeyAuthenticator) Authenticate(ctx context.Context, key RenderKey, _ AuthenticationConfiguration) (RenderUser, bool) {
	value, err := a.store.Get(ctx, fmt.Sprintf(renderKeyCachePrefix, key.value))
	if err != nil {
		return RenderUser{}, false
	}
	var user RenderUser
	if err := gob.NewDecoder(bytes.NewReader(value)).Decode(&user); err != nil {
		return RenderUser{}, false
	}
	return user, true
}
