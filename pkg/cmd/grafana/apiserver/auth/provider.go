package auth

import (
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
)

func NewAuthenticator(validator *Validator, authRequestHandlers ...authenticator.Request) authenticator.Request {
	idTokenAuthenticator := getIDTokenAuthenticatorFunc(validator)

	handlers := append([]authenticator.Request{idTokenAuthenticator}, authRequestHandlers...)
	return union.New(handlers...)
}
