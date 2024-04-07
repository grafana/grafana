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

// TODO: There are equivalent structs in auth package but go.mod was giving me grief
// Those structs are counterintuitively called SignIDTokenRequest and SignIDTokenResponse
// Just because access token signing is implemented pretty similar to ID token signing
type signAccessTokenRequest struct {
}

type accessTokenData struct {
	Token string `json:"token"`
}

// TODO: this should likely be defined in auth package, was defined in a test as local
type signAccessTokenResponse struct {
	Status      string          `json:"status"`
	AccessToken accessTokenData `json:"data,omitempty"`
	Error       string          `json:"error,omitempty"`
}

var _ authenticator.Request = &AccessTokenAuthenticator{}

type AccessTokenAuthenticator struct {
	serviceBaseURL string
	systemCAPToken string
	validator      *TokenValidator
}

// TODO: add tests
func newAccessTokenAuthenticator(options *options.AuthnOptions, client *http.Client) *AccessTokenAuthenticator {
	verifier := authn.NewVerifier[CustomClaims](authn.IDVerifierConfig{
		SigningKeysURL:   options.IDVerifierConfig.SigningKeysURL,
		AllowedAudiences: options.IDVerifierConfig.AllowedAudiences,
	})

	if client == nil {
		client = http.DefaultClient
	}

	return &AccessTokenAuthenticator{
		validator:      &TokenValidator{verifier},
		serviceBaseURL: options.ServiceBaseURL,
		systemCAPToken: options.SystemCAPToken,
	}
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

func (auth *AccessTokenAuthenticator) signAccessToken(idTokenClaims *authn.Claims[CustomClaims]) (string, error) {
	body, err := json.Marshal(signAccessTokenRequest{})
	if err != nil {
		return "", err
	}

	path, err := url.JoinPath(auth.serviceBaseURL, "/v1/sign-access-token")
	if err != nil {
		return "", err
	}
	req, err := newAuthAPIAuthorizedRequest(http.MethodPost, path, auth.systemCAPToken, body)
	if err != nil {
		return "", err
	}

	req.Header.Add("X-Org-ID", idTokenClaims.Rest.OrgId)

	audience := strings.Split(idTokenClaims.Claims.Audience[0], ":")
	req.Header.Add("X-Realms", fmt.Sprintf(`[{"type":"%s","identifier":"%s"}]`, audience[0], audience[1]))

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

	return response.AccessToken.Token, nil
}

func (auth *AccessTokenAuthenticator) AuthenticateRequest(req *http.Request) (*authenticator.Response, bool, error) {
	result, err := auth.validator.Validate(req.Context(), req.Header.Get("X-Grafana-Id"))
	if err != nil {
		return nil, false, err
	}

	// TODO: this getting of access token header is likely wrong and only for supporting the GLSA
	// based workflow in dev (subject to removal)
	accessToken := req.Header.Get(headerKeyAccessToken)
	if len(auth.systemCAPToken) > 0 {
		var err error
		accessToken, err = auth.signAccessToken(result)
		if err != nil {
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

// Returned as a func so appending to a list of request funcs works
// Following basically binds the this for the Request invocation on above struct
func GetAccessTokenAuthenticatorFunc(options *options.AuthnOptions) authenticator.RequestFunc {
	auth := newAccessTokenAuthenticator(options, nil)
	return func(req *http.Request) (*authenticator.Response, bool, error) {
		return auth.AuthenticateRequest(req)
	}
}
