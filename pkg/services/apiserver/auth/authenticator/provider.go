package authenticator

import (
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
)

func NewAuthenticator(authRequestHandlers ...authenticator.Request) authenticator.Request {
	handlers := append([]authenticator.Request{authenticator.RequestFunc(signedInUserAuthenticator)}, authRequestHandlers...)
	return union.New(handlers...)
}
