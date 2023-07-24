package oasimpl

import (
	"context"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/oauth2"
	"github.com/ory/fosite/handler/rfc7523"
	"gopkg.in/square/go-jose.v2"

	"github.com/grafana/grafana/pkg/services/oauthserver/utils"
)

var _ fosite.ClientManager = &OAuth2ServiceImpl{}
var _ oauth2.AuthorizeCodeStorage = &OAuth2ServiceImpl{}
var _ oauth2.AccessTokenStorage = &OAuth2ServiceImpl{}
var _ oauth2.RefreshTokenStorage = &OAuth2ServiceImpl{}
var _ rfc7523.RFC7523KeyStorage = &OAuth2ServiceImpl{}
var _ oauth2.TokenRevocationStorage = &OAuth2ServiceImpl{}

// GetClient loads the client by its ID or returns an error
// if the client does not exist or another error occurred.
func (s *OAuth2ServiceImpl) GetClient(ctx context.Context, id string) (fosite.Client, error) {
	return s.GetExternalService(ctx, id)
}

// ClientAssertionJWTValid returns an error if the JTI is
// known or the DB check failed and nil if the JTI is not known.
func (s *OAuth2ServiceImpl) ClientAssertionJWTValid(ctx context.Context, jti string) error {
	return s.memstore.ClientAssertionJWTValid(ctx, jti)
}

// SetClientAssertionJWT marks a JTI as known for the given
// expiry time. Before inserting the new JTI, it will clean
// up any existing JTIs that have expired as those tokens can
// not be replayed due to the expiry.
func (s *OAuth2ServiceImpl) SetClientAssertionJWT(ctx context.Context, jti string, exp time.Time) error {
	return s.memstore.SetClientAssertionJWT(ctx, jti, exp)
}

// GetAuthorizeCodeSession stores the authorization request for a given authorization code.
func (s *OAuth2ServiceImpl) CreateAuthorizeCodeSession(ctx context.Context, code string, request fosite.Requester) (err error) {
	return s.memstore.CreateAuthorizeCodeSession(ctx, code, request)
}

// GetAuthorizeCodeSession hydrates the session based on the given code and returns the authorization request.
// If the authorization code has been invalidated with `InvalidateAuthorizeCodeSession`, this
// method should return the ErrInvalidatedAuthorizeCode error.
//
// Make sure to also return the fosite.Requester value when returning the fosite.ErrInvalidatedAuthorizeCode error!
func (s *OAuth2ServiceImpl) GetAuthorizeCodeSession(ctx context.Context, code string, session fosite.Session) (request fosite.Requester, err error) {
	return s.memstore.GetAuthorizeCodeSession(ctx, code, session)
}

// InvalidateAuthorizeCodeSession is called when an authorize code is being used. The state of the authorization
// code should be set to invalid and consecutive requests to GetAuthorizeCodeSession should return the
// ErrInvalidatedAuthorizeCode error.
func (s *OAuth2ServiceImpl) InvalidateAuthorizeCodeSession(ctx context.Context, code string) (err error) {
	return s.memstore.InvalidateAuthorizeCodeSession(ctx, code)
}

func (s *OAuth2ServiceImpl) CreateAccessTokenSession(ctx context.Context, signature string, request fosite.Requester) (err error) {
	return s.memstore.CreateAccessTokenSession(ctx, signature, request)
}

func (s *OAuth2ServiceImpl) GetAccessTokenSession(ctx context.Context, signature string, session fosite.Session) (request fosite.Requester, err error) {
	return s.memstore.GetAccessTokenSession(ctx, signature, session)
}

func (s *OAuth2ServiceImpl) DeleteAccessTokenSession(ctx context.Context, signature string) (err error) {
	return s.memstore.DeleteAccessTokenSession(ctx, signature)
}

func (s *OAuth2ServiceImpl) CreateRefreshTokenSession(ctx context.Context, signature string, request fosite.Requester) (err error) {
	return s.memstore.CreateRefreshTokenSession(ctx, signature, request)
}

func (s *OAuth2ServiceImpl) GetRefreshTokenSession(ctx context.Context, signature string, session fosite.Session) (request fosite.Requester, err error) {
	return s.memstore.GetRefreshTokenSession(ctx, signature, session)
}

func (s *OAuth2ServiceImpl) DeleteRefreshTokenSession(ctx context.Context, signature string) (err error) {
	return s.memstore.DeleteRefreshTokenSession(ctx, signature)
}

// RevokeRefreshToken revokes a refresh token as specified in:
// https://tools.ietf.org/html/rfc7009#section-2.1
// If the particular
// token is a refresh token and the authorization server supports the
// revocation of access tokens, then the authorization server SHOULD
// also invalidate all access tokens based on the same authorization
// grant (see Implementation Note).
func (s *OAuth2ServiceImpl) RevokeRefreshToken(ctx context.Context, requestID string) error {
	return s.memstore.RevokeRefreshToken(ctx, requestID)
}

// RevokeRefreshTokenMaybeGracePeriod revokes a refresh token as specified in:
// https://tools.ietf.org/html/rfc7009#section-2.1
// If the particular
// token is a refresh token and the authorization server supports the
// revocation of access tokens, then the authorization server SHOULD
// also invalidate all access tokens based on the same authorization
// grant (see Implementation Note).
//
// If the Refresh Token grace period is greater than zero in configuration the token
// will have its expiration time set as UTCNow + GracePeriod.
func (s *OAuth2ServiceImpl) RevokeRefreshTokenMaybeGracePeriod(ctx context.Context, requestID string, signature string) error {
	return s.memstore.RevokeRefreshTokenMaybeGracePeriod(ctx, requestID, signature)
}

// RevokeAccessToken revokes an access token as specified in:
// https://tools.ietf.org/html/rfc7009#section-2.1
// If the token passed to the request
// is an access token, the server MAY revoke the respective refresh
// token as well.
func (s *OAuth2ServiceImpl) RevokeAccessToken(ctx context.Context, requestID string) error {
	return s.memstore.RevokeAccessToken(ctx, requestID)
}

// GetPublicKey returns public key, issued by 'issuer', and assigned for subject. Public key is used to check
// signature of jwt assertion in authorization grants.
func (s *OAuth2ServiceImpl) GetPublicKey(ctx context.Context, issuer string, subject string, kid string) (*jose.JSONWebKey, error) {
	return s.sqlstore.GetExternalServicePublicKey(ctx, issuer)
}

// GetPublicKeys returns public key, set issued by 'issuer', and assigned for subject.
func (s *OAuth2ServiceImpl) GetPublicKeys(ctx context.Context, issuer string, subject string) (*jose.JSONWebKeySet, error) {
	jwk, err := s.sqlstore.GetExternalServicePublicKey(ctx, issuer)
	if err != nil {
		return nil, err
	}
	return &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{*jwk},
	}, nil
}

// GetPublicKeyScopes returns assigned scope for assertion, identified by public key, issued by 'issuer'.
func (s *OAuth2ServiceImpl) GetPublicKeyScopes(ctx context.Context, issuer string, subject string, kid string) ([]string, error) {
	client, err := s.GetExternalService(ctx, issuer)
	if err != nil {
		return nil, err
	}
	userID, err := utils.ParseUserIDFromSubject(subject)
	if err != nil {
		return nil, err
	}
	return client.GetScopesOnUser(ctx, s.accessControl, userID), nil
}

// IsJWTUsed returns true, if JWT is not known yet or it can not be considered valid, because it must be already
// expired.
func (s *OAuth2ServiceImpl) IsJWTUsed(ctx context.Context, jti string) (bool, error) {
	return s.memstore.IsJWTUsed(ctx, jti)
}

// MarkJWTUsedForTime marks JWT as used for a time passed in exp parameter. This helps ensure that JWTs are not
// replayed by maintaining the set of used "jti" values for the length of time for which the JWT would be
// considered valid based on the applicable "exp" instant. (https://tools.ietf.org/html/rfc7523#section-3)
func (s *OAuth2ServiceImpl) MarkJWTUsedForTime(ctx context.Context, jti string, exp time.Time) error {
	return s.memstore.MarkJWTUsedForTime(ctx, jti, exp)
}
