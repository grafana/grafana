package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
)

// localTokenTTL bounds how long a locally minted token is valid.
const localTokenTTL = 5 * time.Minute

// EnvVarSigningKeys and EnvVarSigningKeysURL name the environment variables
// from which app-sdk plugins read the keys that verify their access tokens.
// A plugin accepts only one of them.
const (
	EnvVarSigningKeys    = "GRAFANA_JWKS"
	EnvVarSigningKeysURL = "GRAFANA_JWKS_URL"
)

// LocalKeyID identifies the local signing key in tokens and in LocalSigningKeys.
const LocalKeyID = "grafana-local"

// RealSigningKeysConfigured reports whether a real token signer is configured,
// either as jwksURL (Grafana's [auth.extended_jwt] jwks_url) or as plugin
// signing keys in Grafana's environment, which go-plugin forwards to plugins.
// Plugins then trust that signer, so Grafana must not sign tokens locally.
func RealSigningKeysConfigured(jwksURL string) bool {
	return jwksURL != "" || os.Getenv(EnvVarSigningKeys) != "" || os.Getenv(EnvVarSigningKeysURL) != ""
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
	return &localExchanger{signer: signer, jwks: string(jwks), keys: localKey{key: &public}}, nil
}

// Exchange implements [authnlib.TokenExchanger].
func (e *localExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	if req.Namespace == "" || len(req.Audiences) == 0 {
		return nil, errors.New("local plugin token exchange: namespace and audiences are required")
	}
	claims := authnlib.AccessTokenClaims{Namespace: req.Namespace}
	if req.SubjectToken != "" {
		actor, err := actorFromSubjectToken(req.SubjectToken)
		if err != nil {
			return nil, err
		}
		claims.Actor = actor
	}
	token, err := e.sign("access-policy:grafana", req.Audiences, claims)
	if err != nil {
		return nil, err
	}
	return &authnlib.TokenExchangeResponse{Token: token}, nil
}

// actorFromSubjectToken returns the delegation chain for the new token: the
// caller of an ID token, or the chain of a previous access token.
func actorFromSubjectToken(token string) (*authnlib.ActorClaims, error) {
	parsed, err := authnlib.Parse(token)
	if err != nil {
		return nil, fmt.Errorf("local plugin token exchange: %w", err)
	}
	typ, err := authnlib.GetType(parsed)
	if err != nil {
		return nil, fmt.Errorf("local plugin token exchange: %w", err)
	}
	var std jwt.Claims
	switch typ {
	case authnlib.TokenTypeID:
		var id authnlib.IDTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &id); err != nil {
			return nil, fmt.Errorf("local plugin token exchange: %w", err)
		}
		return &authnlib.ActorClaims{Subject: std.Subject, IDTokenClaims: id}, nil
	case authnlib.TokenTypeAccess:
		var at authnlib.AccessTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &at); err != nil {
			return nil, fmt.Errorf("local plugin token exchange: %w", err)
		}
		return &authnlib.ActorClaims{Subject: std.Subject, ServiceIdentity: at.ServiceIdentity, Actor: at.Actor}, nil
	default:
		return nil, fmt.Errorf("local plugin token exchange: unsupported subject token type %q", typ)
	}
}
