package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/apiserver/standalone/options"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/authlib/authn"
)

const (
	headerKeyAccessToken = "X-Access-Token"
	headerKeyGrafanaID   = "X-Grafana-Id"

	extraKeyAccessToken = "access-token"
	extraKeyGrafanaID   = "id-token"
	extraKeyGLSA        = "glsa"
)

type signIDTokenRequest struct {
}

type signIDTokenResponse struct {
	Token string `json:"token"`
}

// TODO: this should likely be defined by auth lib
type signAccessTokenResponse struct {
	Status      string              `json:"status"`
	AccessToken signIDTokenResponse `json:"data,omitempty"`
	Error       string              `json:"error,omitempty"`
}

func NewAccessTokenAuthenticator(options *options.AuthnOptions) authenticator.RequestFunc {
	verifier := authn.NewVerifier[CustomClaims](authn.IDVerifierConfig{
		SigningKeysURL:   options.IDVerifierConfig.SigningKeysURL,
		AllowedAudiences: options.IDVerifierConfig.AllowedAudiences,
	})
	return getAccessTokenAuthenticatorFunc(&TokenValidator{verifier}, options)
}

func newAuthAPIAuthorizedRequest(method, path string, token string, body []byte) (*http.Request, error) {
	buffer := bytes.NewBuffer(nil)
	if len(body) > 0 {
		buffer.Write(body)
	}

	req, err := http.NewRequest(method, path, buffer)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Authorization", "Bearer "+token)

	return req, nil
}

func signAccessToken(serviceBaseURL string, systemCAPToken string) (string, error) {
	body, err := json.Marshal(signIDTokenRequest{})
	if err != nil {
		return "", err
	}

	path, err := url.JoinPath(serviceBaseURL, "/v1/sign-access-token")
	if err != nil {
		return "", err
	}
	req, err := newAuthAPIAuthorizedRequest(http.MethodPost, path, systemCAPToken, body)
	if err != nil {
		return "", err
	}
	req.Header.Add("X-Org-ID", "2")
	req.Header.Add("X-Realms", ` [{"type":"stack","identifier":"2846"}]`)

	client := &http.Client{
		Timeout: time.Second * 5,
	}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}

	var response signAccessTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return "", err
	}

	if response.Status == "error" {
		return "", fmt.Errorf(response.Error)
	}

	fmt.Printf("%s:%s:%s", response.Error, response.Status, response.AccessToken)

	return response.AccessToken.Token, nil
}

func getAccessTokenAuthenticatorFunc(validator *TokenValidator, options *options.AuthnOptions) authenticator.RequestFunc {
	return func(req *http.Request) (*authenticator.Response, bool, error) {
		// TODO: this getting of access token header is likely wrong and only for supporting the GLSA
		// based workflow in dev (subject to removal)
		accessToken := req.Header.Get(headerKeyAccessToken)
		if len(options.SystemCAPToken) > 0 {
			fmt.Println("Access token generation...")
			var err error
			accessToken, err = signAccessToken(options.ServiceBaseURL, options.SystemCAPToken)
			if err != nil {
				fmt.Println("error", err)
				return nil, false, err
			}

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
