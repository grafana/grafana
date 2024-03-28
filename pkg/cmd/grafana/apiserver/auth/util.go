package auth

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func AppendToAuthenticators(newAuthenticator authenticator.RequestFunc, authRequestHandlers ...authenticator.Request) authenticator.Request {
	handlers := append([]authenticator.Request{newAuthenticator}, authRequestHandlers...)
	return union.New(handlers...)
}

// Get tokens that can be forwarded to the next service
func GetIDForwardingAuthHeaders(ctx context.Context) (map[string]string, error) {
	user, ok := request.UserFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing user")
	}

	getter := func(key string) string {
		vals, ok := user.GetExtra()[key]
		if ok && len(vals) == 1 {
			return vals[0]
		}
		return ""
	}

	token := getter(extraKeyGLSA)
	if token != "" {
		// Service account tokens get forwarded as auth tokens
		// this lets us keep testing the workflows while the ID token system is in dev
		return map[string]string{
			"Authorization": "Bearer " + token,
		}, nil
	}

	accessToken := getter(extraKeyAccessToken)
	if accessToken == "" {
		return nil, fmt.Errorf("missing access token in user info")
	}

	idToken := getter(extraKeyGrafanaID)
	if idToken != "" {
		return map[string]string{
			headerKeyAccessToken: accessToken,
			headerKeyGrafanaID:   idToken,
		}, nil
	}
	return map[string]string{
		headerKeyAccessToken: accessToken,
	}, nil
}
