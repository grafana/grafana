package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
)

// insecureTokenTTL bounds how long a locally minted token is valid.
const insecureTokenTTL = 5 * time.Minute

// InsecureTokenExchanger returns a process-wide exchanger for local
// development, whose tokens only a plugin that skips verification accepts
// (see insecureExchanger). It must not be used when a real exchanger exists.
func InsecureTokenExchanger() (authnlib.TokenExchanger, error) {
	return sharedInsecureExchanger()
}

var sharedInsecureExchanger = sync.OnceValues(func() (authnlib.TokenExchanger, error) {
	return newInsecureExchanger()
})

// insecureExchanger mints access tokens shaped like exchanged ones, carrying
// the subject token's identity as the actor. They are signed with a key
// generated in memory and never published, so no verifier accepts them.
type insecureExchanger struct {
	signer jose.Signer
}

var _ authnlib.TokenExchanger = (*insecureExchanger)(nil)

func newInsecureExchanger() (*insecureExchanger, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", "insecure-local"))
	if err != nil {
		return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
	}
	return &insecureExchanger{signer: signer}, nil
}

// Exchange implements [authnlib.TokenExchanger].
func (e *insecureExchanger) Exchange(_ context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	if req.Namespace == "" || len(req.Audiences) == 0 {
		return nil, errors.New("insecure plugin token exchange: namespace and audiences are required")
	}
	claims := authnlib.AccessTokenClaims{Namespace: req.Namespace}
	if req.SubjectToken != "" {
		actor, err := actorFromSubjectToken(req.SubjectToken)
		if err != nil {
			return nil, err
		}
		claims.Actor = actor
	}
	now := time.Now()
	token, err := jwt.Signed(e.signer).Claims(jwt.Claims{
		Subject:   "access-policy:grafana",
		Audience:  jwt.Audience(req.Audiences),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Expiry:    jwt.NewNumericDate(now.Add(insecureTokenTTL)),
	}).Claims(claims).Serialize()
	if err != nil {
		return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
	}
	return &authnlib.TokenExchangeResponse{Token: token}, nil
}

// actorFromSubjectToken returns the delegation chain for the new token: the
// caller of an ID token, or the chain of a previous access token.
func actorFromSubjectToken(token string) (*authnlib.ActorClaims, error) {
	parsed, err := authnlib.Parse(token)
	if err != nil {
		return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
	}
	typ, err := authnlib.GetType(parsed)
	if err != nil {
		return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
	}
	var std jwt.Claims
	switch typ {
	case authnlib.TokenTypeID:
		var id authnlib.IDTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &id); err != nil {
			return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
		}
		return &authnlib.ActorClaims{Subject: std.Subject, IDTokenClaims: id}, nil
	case authnlib.TokenTypeAccess:
		var at authnlib.AccessTokenClaims
		if err := parsed.UnsafeClaimsWithoutVerification(&std, &at); err != nil {
			return nil, fmt.Errorf("insecure plugin token exchange: %w", err)
		}
		return &authnlib.ActorClaims{Subject: std.Subject, ServiceIdentity: at.ServiceIdentity, Actor: at.Actor}, nil
	default:
		return nil, fmt.Errorf("insecure plugin token exchange: unsupported subject token type %q", typ)
	}
}
