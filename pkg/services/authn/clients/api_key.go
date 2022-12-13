package clients

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util"
)

const (
	apiKeyPrefix = ""
)

var _ authn.Client = new(ApiKey)

func ProvideApiKey() *ApiKey {
	return &ApiKey{}
}

type ApiKey struct {
}

func (a *ApiKey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	//TODO implement me
	panic("implement me")
}

func (a *ApiKey) Test(ctx context.Context, r *authn.Request) bool {
	// api keys are only supported through http requests
	if r.HTTPRequest == nil {
		return false
	}

	return looksLikeApiKey(r.HTTPRequest.Header.Get("Authorization"))
}

func looksLikeApiKey(header string) bool {
	parts := strings.Split(header, "")

	var keyString string

	if len(parts) == 2 && parts[0] == "Bearer" {
		keyString = parts[1]
	} else {
		username, password, err := util.DecodeBasicAuthHeader(header)
		if err == nil && username == "api_key" {
			keyString = password
		}
	}

	return keyString != ""
}
