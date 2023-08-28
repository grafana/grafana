package oasimpl

import (
	"github.com/ory/fosite/handler/oauth2"
	"github.com/ory/fosite/token/jwt"
)

func NewAuthSession() *oauth2.JWTSession {
	sess := &oauth2.JWTSession{
		JWTClaims: new(jwt.JWTClaims),
		JWTHeader: new(jwt.Headers),
	}
	// Our tokens will follow the RFC9068
	sess.JWTHeader.Add("typ", "at+jwt")
	return sess
}
