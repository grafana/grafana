package auth

import (
	"net/http"
	"strings"

	"github.com/grafana/authlib/authn"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

const (
	headerKeyAccessToken = "X-Access-Token"
	headerKeyGrafanaID   = "X-Grafana-Id"

	extraKeyAccessToken = "access-token"
	extraKeyGrafanaID   = "id-token"
	extraKeyGLSA        = "glsa"
)

func NewAccessTokenAuthenticator(config *authn.IDVerifierConfig) authenticator.RequestFunc {
	verifier := authn.NewVerifier[CustomClaims](authn.IDVerifierConfig{
		SigningKeysURL:   config.SigningKeysURL,
		AllowedAudiences: config.AllowedAudiences,
	})
	return getAccessTokenAuthenticatorFunc(&TokenValidator{verifier})
}

func getAccessTokenAuthenticatorFunc(validator *TokenValidator) authenticator.RequestFunc {
	return func(req *http.Request) (*authenticator.Response, bool, error) {
		accessToken := req.Header.Get(headerKeyAccessToken)
		if accessToken == "" {
			return nil, false, nil
		}

		// While the authn token system is in development, we can temporarily use
		// service account tokens.  Note this does not grant any real permissions/verification,
		// it simply allows forwarding the token to the next request
		if strings.HasPrefix(accessToken, "glsa_") {
			return &authenticator.Response{
				Audiences: authenticator.Audiences([]string{}),
				User: &user.DefaultInfo{
					Name:   "glsa-forwarding-request",
					UID:    "",
					Groups: []string{},
					Extra: map[string][]string{
						extraKeyGLSA: {accessToken},
					},
				},
			}, true, nil
		}

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
					extraKeyAccessToken: {accessToken},
					extraKeyGrafanaID:   {req.Header.Get("X-Grafana-Id")}, // this may exist if starting with a user
				},
			},
		}, true, nil
	}
}
