package auth

import (
	"net/http"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

func NewIDTokenAuthenticator(validator *Validator) authenticator.RequestFunc {
	idTokenAuthenticator := getIDTokenAuthenticatorFunc(validator)
	return idTokenAuthenticator
}

func getIDTokenAuthenticatorFunc(validator *Validator) authenticator.RequestFunc {
	return func(req *http.Request) (*authenticator.Response, bool, error) {
		accessToken := req.Header.Get("X-Access-Token")
		if accessToken == "" {
			return nil, false, nil
		}

		grafanaID := req.Header.Get("X-Grafana-Id")

		result, err := validator.Validate(req.Context(), accessToken)
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
					"access-token": {accessToken},
					"grafana-id":   {grafanaID},
				},
			},
		}, true, nil
	}
}
