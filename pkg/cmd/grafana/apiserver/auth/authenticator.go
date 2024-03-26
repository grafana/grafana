package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

func getIDTokenAuthenticatorFunc(validator *Validator) authenticator.RequestFunc {
	return func(req *http.Request) (*authenticator.Response, bool, error) {
		token, err := extractBearerToken(req)
		if err != nil {
			return nil, false, errors.New("Could not read bearer token from the authorization header")
		}

		if token == "" {
			return nil, false, nil
		}

		result, err := validator.Validate(context.Background(), token)
		if err != nil {
			return nil, false, err
		}

		if err != nil {
			return nil, false, err
		}
		return &authenticator.Response{
			Audiences: authenticator.Audiences(result.Claims.Audience),
			User: &user.DefaultInfo{
				Name:   result.Subject,
				UID:    "",
				Groups: []string{},
				Extra: map[string][]string{
					"id-token": {token},
				},
			},
		}, true, nil
	}
}

func extractBearerToken(r *http.Request) (string, error) {
	headerValue := r.Header.Get("Authorization")
	if headerValue == "" {
		return "", nil
	}

	headerValueParts := strings.Fields(headerValue)
	if len(headerValueParts) != 2 || strings.ToLower(headerValueParts[0]) != "bearer" {
		return "", errors.New("authorization header format must be of the form: Bearer {token}")
	}

	return headerValueParts[1], nil
}
