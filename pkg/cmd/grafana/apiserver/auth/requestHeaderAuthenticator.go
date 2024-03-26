package auth

import (
	"context"
	"net/http"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	genericapiserver "k8s.io/apiserver/pkg/server"
)

type WrappedRequestHeaderAuthenticator struct {
	original  authenticator.Request
	validator *Validator
}

func (w WrappedRequestHeaderAuthenticator) AuthenticateRequest(req *http.Request) (*authenticator.Response, bool, error) {
	resp, authedByOriginal, err := w.original.AuthenticateRequest(req)

	if err != nil {
		return nil, false, err
	}

	if !authedByOriginal {
		return nil, false, nil
	}

	extras := resp.User.GetExtra()
	idToken, ok := extras["id-token"]
	if !ok || len(idToken) == 0 {
		return nil, false, nil
	}

	_, err = w.validator.Validate(context.Background(), idToken[0])
	if err != nil {
		return nil, false, err
	}

	return resp, true, nil
}

func NewWrappedRequestHeaderAuthenticator(genericConfig *genericapiserver.RecommendedConfig, validator *Validator) authenticator.Request {
	original := headerrequest.NewDynamicVerifyOptionsSecure(
		genericConfig.Authentication.RequestHeaderConfig.CAContentProvider.VerifyOptions,
		genericConfig.Authentication.RequestHeaderConfig.AllowedClientNames,
		genericConfig.Authentication.RequestHeaderConfig.UsernameHeaders,
		genericConfig.Authentication.RequestHeaderConfig.GroupHeaders,
		genericConfig.Authentication.RequestHeaderConfig.ExtraHeaderPrefixes,
	)
	return &WrappedRequestHeaderAuthenticator{original, validator}
}
