package clients

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	basicPrefix  = "Basic "
	bearerPrefix = "Bearer "
)

var (
	ErrAPIKeyExpired = errutil.NewBase(errutil.StatusUnauthorized, "apikey.expired", errutil.WithPublicMessage("Expired API key"))
	ErrAPIKeyRevoked = errutil.NewBase(errutil.StatusUnauthorized, "apikey.revoked", errutil.WithPublicMessage("Revoked API key"))
)

var _ authn.Client = new(APIKey)

func ProvideAPIKey(service apikey.Service) *APIKey {
	return &APIKey{
		service: service,
		log:     log.New(authn.ClientAPIKey),
	}
}

type APIKey struct {
	service apikey.Service
	log     log.Logger
}

func (s *APIKey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	apiKey, err := s.getAPIKey(ctx, getTokenFromRequest(r))
	if err != nil {
		return nil, err
	}

	if apiKey.Expires != nil && *apiKey.Expires <= time.Now().Unix() {
		return nil, ErrAPIKeyExpired
	}

	if apiKey.IsRevoked != nil && *apiKey.IsRevoked {
		return nil, ErrAPIKeyRevoked
	}

	go func(id int64) {
		if err := s.service.UpdateAPIKeyLastUsedDate(context.Background(), id); err != nil {
			s.log.Warn("failed to update last use date for api key", "id", id)
		}
	}(apiKey.Id)

	identity := &authn.Identity{}
	identity.OrgID = apiKey.OrgId
	// Not correct for a service account
	identity.OrgRoles = map[int64]org.RoleType{apiKey.OrgId: apiKey.Role}

	return identity, nil
}

func (s *APIKey) getAPIKey(ctx context.Context, token string) (*apikey.APIKey, error) {
	fn := s.getFromToken
	if !strings.HasPrefix(token, apikeygenprefix.GrafanaPrefix) {
		fn = s.getFromTokenLegacy
	}

	apiKey, err := fn(ctx, token)
	if err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (s *APIKey) getFromToken(ctx context.Context, token string) (*apikey.APIKey, error) {
	decoded, err := apikeygenprefix.Decode(token)
	if err != nil {
		return nil, err
	}

	hash, err := decoded.Hash()
	if err != nil {
		return nil, err
	}

	return s.service.GetAPIKeyByHash(ctx, hash)
}

func (s *APIKey) getFromTokenLegacy(ctx context.Context, token string) (*apikey.APIKey, error) {
	decoded, err := apikeygen.Decode(token)
	if err != nil {
		return nil, err
	}

	// fetch key
	keyQuery := apikey.GetByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := s.service.GetApiKeyByName(ctx, &keyQuery); err != nil {
		return nil, err
	}

	// validate api key
	isValid, err := apikeygen.IsValid(decoded, keyQuery.Result.Key)
	if err != nil {
		return nil, err
	}
	if !isValid {
		return nil, apikeygen.ErrInvalidApiKey
	}

	return keyQuery.Result, nil
}

func (s *APIKey) Test(ctx context.Context, r *authn.Request) bool {
	return looksLikeApiKey(getTokenFromRequest(r))
}

func looksLikeApiKey(token string) bool {
	return token != ""
}

func getTokenFromRequest(r *authn.Request) string {
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
