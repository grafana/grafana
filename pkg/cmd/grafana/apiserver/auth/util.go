package auth

import (
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
)

func AppendToAuthenticators(newAuthenticator authenticator.RequestFunc, authRequestHandlers ...authenticator.Request) authenticator.Request {
	handlers := append([]authenticator.Request{newAuthenticator}, authRequestHandlers...)
	return union.New(handlers...)
}
