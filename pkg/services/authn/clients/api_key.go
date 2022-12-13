package clients

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util"
)

const (
	basicPrefix  = "Basic "
	bearerPrefix = "Bearer "
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
	return looksLikeApiKey(getApiKey(r))
}

func looksLikeApiKey(token string) bool {
	return token != ""
}

func getApiKey(r *authn.Request) string {
	// api keys are only supported through http requests
	if r.HTTPRequest == nil {
		return ""
	}

	header := r.HTTPRequest.Header.Get("Authorization")

	if strings.HasPrefix(header, bearerPrefix) {
		return strings.TrimPrefix(header, bearerPrefix)
	}
	if strings.HasPrefix(header, basicPrefix) {
		username, password, err := util.DecodeBasicAuthHeader(header)
		if err == nil && username == "api_key" {
			return password
		}
	}
	return ""
}
