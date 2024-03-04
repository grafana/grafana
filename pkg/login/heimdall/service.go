// Package service provides the implementation of various service functions for user authorization and tag assignment.

package heimdall

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
)

var (
	logger = log.New("dataos.heimdall")
)

type BasicUserInfo struct {
	Id             string
	Name           string
	Email          string
	Login          string
	Role           org.RoleType
	IsGrafanaAdmin *bool // nil will avoid overriding user's set server admin setting
	Groups         []string
}

type AuthorizationRequest struct {
	Token string `json:"token"`
}

type AuthorizationResponse struct {
	Allow  bool                `json:"allow,omitempty" binding:"required"`
	Result AuthorizationResult `json:"result,omitempty"`
	Error  string              `json:"error,omitempty"`
}

type AuthorizationResult struct {
	ID   string      `json:"id"`
	Data interface{} `json:"data,omitempty"`
	Tags []string    `json:"tags,omitempty"`
}

const (
	AuthorizePath = "/api/v1/authorize"
	ContentType   = "application/json"
)

type config struct {
	DataosAdminTagsKey string `env:"DATAOS_ADMIN_ACCESS_TAGS"`
	HeimdallUseUnsafe  string `env:"HEIMDALL_USE_UNSAFE" envDefault:"true"`
	HeimdallBaseUrlKey string `env:"HEIMDALL_BASE_URL" envDefault:"true"`
}

// Authorize sends a POST request to the specified authorization URL
// with the provided authorization request, using the given HTTP client.
// It returns the authorization response and any encountered error.
func Authorize(authorizeUrl string, authz AuthorizationRequest) (*AuthorizationResponse, error) {

	myClient := client(&config{})

	req, err := json.Marshal(authz)
	if err != nil {
		logger.Debug("Error marshaling JSON:", err)
		return nil, err
	}
	authReq := bytes.NewReader(req)

	response, err := myClient.Post(authorizeUrl, ContentType, authReq)
	if err != nil {
		logger.Debug("could not call the authorization resource: ", err)
		return nil, err
	}
	if response == nil {
		logger.Debug("user authorization failed: response is nil")
		return nil, errors.New("user authorization failed: response is nil")
	}
	var ar AuthorizationResponse
	responseContent, err := io.ReadAll(response.Body)
	if err != nil {
		logger.Debug("failed to ready response: ", err)
		return nil, err
	}
	if len(responseContent) == 0 {
		logger.Warn("response content is blank")
		return nil, errors.New("response content is blank")
	}
	err = json.Unmarshal(responseContent, &ar)
	if err != nil {
		logger.Debug("could not unmarshal authorization response json: %s", err)
		return nil, err
	}
	if response.StatusCode != 200 {
		var errorResponse = ar.Error
		if len(responseContent) == 0 {
			errorResponse = response.Status
		}
		logger.Debug("user authorization failed: ", errorResponse)
		return nil, errors.New(errorResponse)
	}
	return &ar, nil
}

// AuthorizeUser performs user authorization using Heimdall.
// It validates the user's token against Heimdall's authorization service
// and updates the provided BasicUserInfo with appropriate role and admin status.
// It returns an error if authorization fails or encounters any issues.
func AuthorizeUser(token string, userInfo *BasicUserInfo,) (*BasicUserInfo, error) {
	var config *config
	logger.Info("calling heimdall for authorization...")
	heimdallBaseUrl := config.HeimdallBaseUrlKey
	if len(heimdallBaseUrl) <= 0 {
		logger.Warn(fmt.Sprintf("environment variable %s not configured", config.HeimdallBaseUrlKey))
		return nil, errors.New(fmt.Sprintf("environment variable %s not configured", config.HeimdallBaseUrlKey))
	}
	adminTag := strings.ReplaceAll(config.DataosAdminTagsKey, " ", "")
	if len(adminTag) <= 0 {
		logger.Warn(fmt.Sprintf("environment variable %s not configured", config.DataosAdminTagsKey))
		return nil, errors.New(fmt.Sprintf("environment variable %s not configured", config.DataosAdminTagsKey))
	}
	adminTags := strings.Split(adminTag, ",")
	if len(adminTags) < 1 {
		logger.Warn("no admin tags provided")
		return nil, errors.New("no admin tags provided")
	}

	authorizeUrl := strings.TrimSuffix(heimdallBaseUrl, "/") + AuthorizePath
	req := AuthorizationRequest{
		Token: token,
	}
	ar, err := Authorize(authorizeUrl, req)
	if err != nil {
		logger.Debug("failure during the authorize request: %s", err)
		return nil, err
	}
	if !ar.Allow {
		return nil, errors.New("allow=false")
	}
	if ar.Result.ID == "" {
		return nil, errors.New("failure during the authorize request, user id is nil")
	}
	if len(ar.Result.Tags) == 0 {
		return nil, errors.New("no tags found for the user")
	}

	var admin = false
	userInfo.Role = org.RoleViewer
	userInfo.IsGrafanaAdmin = &admin

	if findCommonTag(ar.Result.Tags, adminTags) {
		admin = true
		userInfo.Role = org.RoleAdmin
		userInfo.IsGrafanaAdmin = &admin
	}

	return userInfo, nil
}

// findCommonTag checks if there are any common tags between the user tags and admin tags.
// It returns true if a common tag is found; otherwise, it returns false.
func findCommonTag(userTags, adminTags []string) bool {
	adminTagsMap := make(map[string]bool)
	for _, adminTag := range adminTags {
		adminTagsMap[adminTag] = true
	}
	for _, userTag := range userTags {
		if adminTagsMap[userTag] {
			return true
		}
	}
	return false
}

// client configures an HTTP client with TLS verification disabled.
func client(config *config) *http.Client {
	if config.HeimdallUseUnsafe == "true" {
		tr := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
		return &http.Client{Transport: tr}
	} else if config.HeimdallUseUnsafe == "false" {
		tr := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
		}
		return &http.Client{Transport: tr}
	} else {
		fmt.Println("Value of HEIMDALL_USE_UNSAFE is neither true nor false")
		return nil
	}
}
