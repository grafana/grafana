package oasimpl

import (
	"time"

	"github.com/mohae/deepcopy"
	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/oauth2"
	"github.com/ory/fosite/token/jwt"
)

type AuthSession struct {
	oauth2.JWTSession
}

func NewAuthSession(subject string) *AuthSession {
	return &AuthSession{
		JWTSession: oauth2.JWTSession{
			JWTClaims: new(jwt.JWTClaims),
			JWTHeader: new(jwt.Headers),
			Subject:   subject,
		},
	}
}

func (s *AuthSession) GetJWTClaims() jwt.JWTClaimsContainer {
	if s.JWTClaims == nil {
		s.JWTClaims = &jwt.JWTClaims{}
	}

	s.JWTClaims.Subject = s.Subject
	return s.JWTClaims
}

func (s *AuthSession) GetJWTHeader() *jwt.Headers {
	if s.JWTHeader == nil {
		s.JWTHeader = &jwt.Headers{}
	}
	// RFC9068
	s.JWTHeader.Add("typ", "at+jwt")

	return s.JWTHeader
}

func (s *AuthSession) SetExpiresAt(key fosite.TokenType, exp time.Time) {
	if s.ExpiresAt == nil {
		s.ExpiresAt = make(map[fosite.TokenType]time.Time)
	}
	s.ExpiresAt[key] = exp
}

func (s *AuthSession) GetExpiresAt(key fosite.TokenType) time.Time {
	if s.ExpiresAt == nil {
		s.ExpiresAt = make(map[fosite.TokenType]time.Time)
	}

	if _, ok := s.ExpiresAt[key]; !ok {
		return time.Time{}
	}
	return s.ExpiresAt[key]
}

func (s *AuthSession) GetUsername() string {
	if s == nil {
		return ""
	}
	return s.Username
}

func (s *AuthSession) SetSubject(subject string) {
	s.Subject = subject
}

func (s *AuthSession) GetSubject() string {
	if s == nil {
		return ""
	}

	return s.Subject
}

func (s *AuthSession) Clone() fosite.Session {
	if s == nil {
		return nil
	}

	return deepcopy.Copy(s).(fosite.Session)
}

// GetExtraClaims implements ExtraClaimsSession for JWTSession.
// The returned value is a copy of JWTSession claims.
func (s *AuthSession) GetExtraClaims() map[string]interface{} {
	if s == nil {
		return nil
	}

	// We make a clone so that WithScopeField does not change the original value.
	return s.Clone().(*AuthSession).GetJWTClaims().WithScopeField(jwt.JWTScopeFieldString).ToMapClaims()
}
