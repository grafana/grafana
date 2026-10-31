package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana-app-sdk/plugin"
)

// localTokenTTL is the lifetime for the existing service and subject-token flows.
const localTokenTTL = 5 * time.Minute

// LocalKeyID identifies the local signing key in tokens and in LocalSigningKeys.
const LocalKeyID = "grafana-local"

// RealSigningKeysConfigured reports whether a real token signer is configured,
// either as jwksURL (Grafana's [auth.extended_jwt] jwks_url) or as plugin
// signing keys in Grafana's environment, which go-plugin forwards to plugins.
// Plugins then trust that signer, so Grafana must not sign tokens locally.
func RealSigningKeysConfigured(jwksURL string) bool {
	return jwksURL != "" || os.Getenv(plugin.EnvVarGrafanaJWKS) != "" || os.Getenv(plugin.EnvVarGrafanaJWKSURL) != ""
}

// LocalTokenExchanger returns a process-wide exchanger, for when neither a
// token exchange nor real signing keys are configured. Its tokens are signed
// with a key generated in memory, which only plugins started with
// LocalSigningKeys trust: those started by this Grafana process.
func LocalTokenExchanger() (authnlib.TokenExchanger, error) {
	e, err := sharedLocalExchanger()
	if err != nil {
		return nil, err
	}
	return e, nil
}

// LocalSigningKeys returns the JWKS, as a JSON document, that verifies the
// tokens of LocalTokenExchanger. It holds only the public key.
func LocalSigningKeys() (string, error) {
	e, err := sharedLocalExchanger()
	if err != nil {
		return "", err
	}
	return e.jwks, nil
}

var sharedLocalExchanger = sync.OnceValues(newLocalExchanger)

// LocalKeyRetriever returns the key retriever that verifies the tokens of
// LocalTokenExchanger and SignLocalAccessToken, for Grafana's own API.
func LocalKeyRetriever() (authnlib.KeyRetriever, error) {
	e, err := sharedLocalExchanger()
	if err != nil {
		return nil, err
	}
	return e.keys, nil
}

// localExchanger mints access tokens shaped like exchanged ones, carrying the
// subject token's identity as the actor.
type localExchanger struct {
	signer jose.Signer
	jwks   string
	keys   localKey
	tokens localTokenCache
}

// localKey is the KeyRetriever for the local signing key.
type localKey struct{ key *jose.JSONWebKey }

func (k localKey) Get(_ context.Context, keyID string) (*jose.JSONWebKey, error) {
	if keyID != k.key.KeyID {
		return nil, authnlib.ErrInvalidSigningKey
	}
	return k.key, nil
}

var _ authnlib.TokenExchanger = (*localExchanger)(nil)

func newLocalExchanger() (*localExchanger, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("local plugin token exchange: %w", err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", LocalKeyID))
	if err != nil {
		return nil, fmt.Errorf("local plugin token exchange: %w", err)
	}
	public := jose.JSONWebKey{
		Key:       &key.PublicKey,
		KeyID:     LocalKeyID,
		Algorithm: string(jose.ES256),
		Use:       "sig",
	}
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{public}})
	if err != nil {
		return nil, fmt.Errorf("local plugin token exchange: %w", err)
	}
	return &localExchanger{signer: signer, jwks: string(jwks), keys: localKey{key: &public}, tokens: localTokenCache{tokens: map[[sha256.Size]byte]cachedLocalToken{}}}, nil
}

// Exchange implements [authnlib.TokenExchanger].
func (e *localExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	if err := validateExchangeRequest(req); err != nil {
		return nil, err
	}
	now := time.Now()
	// Only the namespace, audiences and subject token shape the token, so a
	// request with anything else is signed afresh.
	cacheable := req.Subject == nil && req.ExpiresIn == nil && len(req.RestrictedDelegatedPermissions) == 0
	var key [sha256.Size]byte
	if cacheable {
		key = localTokenKey(req)
		if token, ok := e.tokens.get(key, now); ok {
			return &authnlib.TokenExchangeResponse{Token: token}, nil
		}
	}
	claims := authnlib.AccessTokenClaims{Namespace: req.Namespace}
	var subjectExpiry time.Time
	if req.SubjectToken != "" {
		actor, expiry, err := actorFromSubjectToken(req.SubjectToken)
		if err != nil {
			return nil, err
		}
		claims.Actor, subjectExpiry = actor, expiry
	}
	token, err := e.sign("access-policy:grafana", req.Audiences, claims, localTokenTTL)
	if err != nil {
		return nil, err
	}
	if cacheable {
		// Reuse it for at most half its lifetime, so a reused token always
		// has minutes left, and never past the subject token's expiry.
		reuseUntil := now.Add(localTokenReuse)
		if !subjectExpiry.IsZero() && subjectExpiry.Before(reuseUntil) {
			reuseUntil = subjectExpiry
		}
		e.tokens.add(key, cachedLocalToken{token: token, reuseUntil: reuseUntil}, now)
	}
	return &authnlib.TokenExchangeResponse{Token: token}, nil
}

// localTokenReuse is how long Exchange hands out a token it signed again.
const localTokenReuse = localTokenTTL / 2

// localTokenCacheSize bounds the tokens Exchange keeps, one per distinct
// request.
const localTokenCacheSize = 1024

// localTokenCache keeps the tokens Exchange signed, by the exact request, so
// that a plugin call doesn't sign one each time. Signing costs an ECDSA
// signature and a parse of the subject token.
type localTokenCache struct {
	mu     sync.Mutex
	tokens map[[sha256.Size]byte]cachedLocalToken
}

type cachedLocalToken struct {
	token      string
	reuseUntil time.Time
}

func (c *localTokenCache) get(key [sha256.Size]byte, now time.Time) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	cached, ok := c.tokens[key]
	if !ok || !now.Before(cached.reuseUntil) {
		return "", false
	}
	return cached.token, true
}

func (c *localTokenCache) add(key [sha256.Size]byte, cached cachedLocalToken, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.tokens) >= localTokenCacheSize {
		for k, t := range c.tokens {
			if !now.Before(t.reuseUntil) {
				delete(c.tokens, k)
			}
		}
		if len(c.tokens) >= localTokenCacheSize {
			clear(c.tokens)
		}
	}
	c.tokens[key] = cached
}

// localTokenKey identifies an exchange request by its namespace, audiences in
// order, and the full subject token. Each field is length-prefixed, so no two
// different requests share a key.
func localTokenKey(req authnlib.TokenExchangeRequest) [sha256.Size]byte {
	h := sha256.New()
	write := func(s string) {
		_, _ = fmt.Fprintf(h, "%d:%s", len(s), s)
	}
	write(req.Namespace)
	_, _ = fmt.Fprintf(h, "%d:", len(req.Audiences))
	for _, audience := range req.Audiences {
		write(audience)
	}
	write(req.SubjectToken)
	var key [sha256.Size]byte
	h.Sum(key[:0])
	return key
}

func validateExchangeRequest(req authnlib.TokenExchangeRequest) error {
	if req.Namespace == "" || len(req.Audiences) == 0 {
		return errors.New("local plugin token exchange: namespace and audiences are required")
	}
	return nil
}

// actorFromSubjectToken returns the delegation chain for the new token: the
// caller of an ID token, or the chain of a previous access token. It also
// returns the subject token's expiry, zero if it has none.
func actorFromSubjectToken(token string) (*authnlib.ActorClaims, time.Time, error) {
	parsed, err := authnlib.Parse(token)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("local plugin token exchange: %w", err)
	}
	typ, err := authnlib.GetType(parsed)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("local plugin token exchange: %w", err)
	}
	var std jwt.Claims
	var actor *authnlib.ActorClaims
	switch typ {
	case authnlib.TokenTypeID:
		var id authnlib.IDTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &id); err != nil {
			return nil, time.Time{}, fmt.Errorf("local plugin token exchange: %w", err)
		}
		actor = &authnlib.ActorClaims{Subject: std.Subject, IDTokenClaims: id}
	case authnlib.TokenTypeAccess:
		var at authnlib.AccessTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &at); err != nil {
			return nil, time.Time{}, fmt.Errorf("local plugin token exchange: %w", err)
		}
		actor = &authnlib.ActorClaims{Subject: std.Subject, ServiceIdentity: at.ServiceIdentity, Actor: at.Actor}
	default:
		return nil, time.Time{}, fmt.Errorf("local plugin token exchange: unsupported subject token type %q", typ)
	}
	var expiry time.Time
	if std.Expiry != nil {
		expiry = std.Expiry.Time()
	}
	return actor, expiry, nil
}
