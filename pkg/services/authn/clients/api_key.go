package clients

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/util"
)

const (
	basicPrefix  = "Basic "
	bearerPrefix = "Bearer "
)

var _ authn.Client = new(APIKey)

func ProvideAPIKey(service apikey.Service) *APIKey {
	return &APIKey{}
}

type APIKey struct {
	service apikey.Service
}

func (a *APIKey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	key := getApiKey(r)
	if key == "" {
		// TODO: return error
		return nil, errors.New("temp")
	}

	//TODO implement me
	panic("implement me")
}

func (a *APIKey) Test(ctx context.Context, r *authn.Request) bool {
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
