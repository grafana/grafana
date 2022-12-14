package clients

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/apikeygen"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	basicPrefix  = "Basic "
	bearerPrefix = "Bearer "
)

var (
	ErrAPIKeyExpired          = errutil.NewBase(errutil.StatusUnauthorized, "api-key.expired", errutil.WithPublicMessage("Expired API key"))
	ErrAPIKeyRevoked          = errutil.NewBase(errutil.StatusUnauthorized, "api-key.revoked", errutil.WithPublicMessage("Revoked API key"))
	ErrServiceAccountDisabled = errutil.NewBase(errutil.StatusUnauthorized, "service-account.disabled", errutil.WithPublicMessage("Disabled service account"))
)

var _ authn.Client = new(APIKey)

func ProvideAPIKey(apiKeyService apikey.Service, userService user.Service) *APIKey {
	return &APIKey{
		log:           log.New(authn.ClientAPIKey),
		userService:   userService,
		apiKeyService: apiKeyService,
	}
}

type APIKey struct {
	log           log.Logger
	userService   user.Service
	apiKeyService apikey.Service
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
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("api key authentication panic", "err", err)
			}
		}()
		if err := s.apiKeyService.UpdateAPIKeyLastUsedDate(context.Background(), id); err != nil {
			s.log.Warn("failed to update last use date for api key", "id", id)
		}
	}(apiKey.Id)

	// if the api key don't belong to a service account construct the identity and return it
	if apiKey.ServiceAccountId == nil || *apiKey.ServiceAccountId < 1 {
		return &authn.Identity{
			ID:       fmt.Sprintf("%s:%d", authn.APIKeyIDPrefix, apiKey.Id),
			OrgID:    apiKey.OrgId,
			OrgRoles: map[int64]org.RoleType{apiKey.OrgId: apiKey.Role},
		}, nil
	}

	usr, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{
		UserID: *apiKey.ServiceAccountId,
		OrgID:  apiKey.OrgId,
	})

	if err != nil {
		return nil, err
	}

	if usr.IsDisabled {
		return nil, ErrServiceAccountDisabled
	}

	return authn.IdentityFromSignedInUser(fmt.Sprintf("%s:%d", authn.ServiceAccountIDPrefix, *apiKey.ServiceAccountId), usr), nil
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

	return s.apiKeyService.GetAPIKeyByHash(ctx, hash)
}

func (s *APIKey) getFromTokenLegacy(ctx context.Context, token string) (*apikey.APIKey, error) {
	decoded, err := apikeygen.Decode(token)
	if err != nil {
		return nil, err
	}

	// fetch key
	keyQuery := apikey.GetByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := s.apiKeyService.GetApiKeyByName(ctx, &keyQuery); err != nil {
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
