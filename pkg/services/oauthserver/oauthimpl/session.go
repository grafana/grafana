package oauthimpl

import (
	"time"

	"github.com/mohae/deepcopy"
	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/oauth2"
	"github.com/ory/fosite/token/jwt"
)

type PluginAuthSession struct {
	oauth2.JWTSession
	Extra map[string]interface{} `json:"extra"`
}

func NewPluginAuthSession(subject string) *PluginAuthSession {
	return &PluginAuthSession{
		JWTSession: oauth2.JWTSession{
			JWTClaims: new(jwt.JWTClaims),
			JWTHeader: new(jwt.Headers),
			Subject:   subject,
		},
		Extra: map[string]interface{}{},
	}
}

func (s *PluginAuthSession) GetJWTClaims() jwt.JWTClaimsContainer {
	if s.JWTClaims == nil {
		s.JWTClaims = &jwt.JWTClaims{}
	}

	s.JWTClaims.Subject = s.Subject
	return s.JWTClaims
}

func (s *PluginAuthSession) GetJWTHeader() *jwt.Headers {
	if s.JWTHeader == nil {
		s.JWTHeader = &jwt.Headers{}
	}
	// RFC9068
	s.JWTHeader.Add("typ", "at+jwt")

	return s.JWTHeader
}

func (s *PluginAuthSession) SetExpiresAt(key fosite.TokenType, exp time.Time) {
	if s.ExpiresAt == nil {
		s.ExpiresAt = make(map[fosite.TokenType]time.Time)
	}
	s.ExpiresAt[key] = exp
}

func (s *PluginAuthSession) GetExpiresAt(key fosite.TokenType) time.Time {
	if s.ExpiresAt == nil {
		s.ExpiresAt = make(map[fosite.TokenType]time.Time)
	}

	if _, ok := s.ExpiresAt[key]; !ok {
		return time.Time{}
	}
	return s.ExpiresAt[key]
}

func (s *PluginAuthSession) GetUsername() string {
	if s == nil {
		return ""
	}
	return s.Username
}

func (s *PluginAuthSession) SetSubject(subject string) {
	s.Subject = subject
}

func (s *PluginAuthSession) GetSubject() string {
	if s == nil {
		return ""
	}

	return s.Subject
}

func (s *PluginAuthSession) Clone() fosite.Session {
	if s == nil {
		return nil
	}

	return deepcopy.Copy(s).(fosite.Session)
}

// GetExtraClaims implements ExtraClaimsSession for JWTSession.
// The returned value is a copy of JWTSession claims.
func (s *PluginAuthSession) GetExtraClaims() map[string]interface{} {
	if s == nil {
		return nil
	}

	// We make a clone so that WithScopeField does not change the original value.
	return s.Clone().(*oauth2.JWTSession).GetJWTClaims().WithScopeField(jwt.JWTScopeFieldString).ToMapClaims()
}

func (s *PluginAuthSession) SetClientID(clientID string) *jwt.JWTClaims {
	if s.JWTClaims == nil {
		s.JWTClaims = &jwt.JWTClaims{}
	}

	s.JWTClaims.Add("client_id", clientID)
	return s.JWTClaims
}
