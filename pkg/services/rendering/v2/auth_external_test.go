package v2_test

import (
	"context"

	renderingv2 "github.com/grafana/grafana/pkg/services/rendering/v2"
)

var _ renderingv2.CallbackAuthenticator = externalAuthenticator{}

type externalAuthenticator struct{}

func (externalAuthenticator) Authorize(_ context.Context, request renderingv2.AuthorizationRequest) (renderingv2.CallbackAuthorization, error) {
	return renderingv2.NewAccessTokenCallbackAuthorization(request.Headers().Get(renderingv2.AccessTokenHeader))
}

func (externalAuthenticator) Authenticate(_ context.Context, _ renderingv2.RenderKey, _ renderingv2.AuthenticationConfiguration) (renderingv2.RenderUser, bool) {
	return renderingv2.RenderUser{}, false
}
