package clients

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

var (
	errAPIKeyInvalid     = errutil.Unauthorized("api-key.invalid", errutil.WithPublicMessage("Invalid API key"))
	errAPIKeyExpired     = errutil.Unauthorized("api-key.expired", errutil.WithPublicMessage("Expired API key"))
	errAPIKeyRevoked     = errutil.Unauthorized("api-key.revoked", errutil.WithPublicMessage("Revoked API key"))
	errAPIKeyOrgMismatch = errutil.Unauthorized("api-key.organization-mismatch", errutil.WithPublicMessage("API key does not belong to the requested organization"))

	errAPIKeyInvalidType = errutil.BadRequest("api-key.invalid-type-id")
)

var (
	_ authn.HookClient             = new(APIKey)
	_ authn.ContextAwareClient     = new(APIKey)
	_ authn.IdentityResolverClient = new(APIKey)
)

const (
	metaKeyID           = "keyID"
	metaKeySkipLastUsed = "keySkipLastUsed"
)

func ProvideAPIKey(apiKeyService apikey.Service) *APIKey {
	return &APIKey{
		log:           log.New(authn.ClientAPIKey),
		apiKeyService: apiKeyService,
	}
}

type APIKey struct {
	log           log.Logger
	apiKeyService apikey.Service
}

func (s *APIKey) Name() string {
	return authn.ClientAPIKey
}

func (s *APIKey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	key, err := s.getAPIKey(ctx, getTokenFromRequest(r))
	if err != nil {
		if errors.Is(err, apikeygen.ErrInvalidApiKey) {
			return nil, errAPIKeyInvalid.Errorf("API key is invalid")
		}
		return nil, err
	}

	if r.OrgID == 0 {
		r.OrgID = key.OrgID
	}

	if err := validateApiKey(r.OrgID, key); err != nil {
		return nil, err
	}

	// Set keyID so we can use it in last used hook
	r.SetMeta(metaKeyID, strconv.FormatInt(key.ID, 10))
	if !shouldUpdateLastUsedAt(key) {
		// Hack to just have some value, we will check this key in the hook
		// and if its not an empty string we will not update last used.
		r.SetMeta(metaKeySkipLastUsed, "true")
	}

	// if the api key don't belong to a service account construct the identity and return it
	if key.ServiceAccountId == nil || *key.ServiceAccountId < 1 {
		return newAPIKeyIdentity(key), nil
	}

	return newServiceAccountIdentity(key), nil
}

func (s *APIKey) IsEnabled() bool {
	return true
}

func (s *APIKey) getAPIKey(ctx context.Context, token string) (*apikey.APIKey, error) {
	fn := s.getFromToken
	if !strings.HasPrefix(token, satokengen.GrafanaPrefix) {
		fn = s.getFromTokenLegacy
	}

	apiKey, err := fn(ctx, token)
	if err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (s *APIKey) getFromToken(ctx context.Context, token string) (*apikey.APIKey, error) {
	decoded, err := satokengen.Decode(token)
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
	keyQuery := apikey.GetByNameQuery{KeyName: decoded.Name, OrgID: decoded.OrgId}
	key, err := s.apiKeyService.GetApiKeyByName(ctx, &keyQuery)
	if err != nil {
		return nil, err
	}

	// validate api key
	isValid, err := apikeygen.IsValid(decoded, key.Key)
	if err != nil {
		return nil, err
	}
	if !isValid {
		return nil, apikeygen.ErrInvalidApiKey
	}

	return key, nil
}

func (s *APIKey) Test(ctx context.Context, r *authn.Request) bool {
	return looksLikeApiKey(getTokenFromRequest(r))
}

func (s *APIKey) Priority() uint {
	return 30
}

func (s *APIKey) IdentityType() claims.IdentityType {
	return claims.TypeAPIKey
}

func (s *APIKey) ResolveIdentity(ctx context.Context, orgID int64, typ claims.IdentityType, id string) (*authn.Identity, error) {
	if !claims.IsIdentityType(typ, claims.TypeAPIKey) {
		return nil, errAPIKeyInvalidType.Errorf("got unexpected type: %s", typ)
	}

	apiKeyID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil, err
	}

	key, err := s.apiKeyService.GetApiKeyById(ctx, &apikey.GetByIDQuery{
		ApiKeyID: apiKeyID,
	})
	if err != nil {
		return nil, err
	}

	if err := validateApiKey(orgID, key); err != nil {
		return nil, err
	}

	if key.ServiceAccountId != nil && *key.ServiceAccountId >= 1 {
		return nil, errAPIKeyInvalidType.Errorf("api key belongs to service account")
	}

	return newAPIKeyIdentity(key), nil
}

func (s *APIKey) Hook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	if r.GetMeta(metaKeySkipLastUsed) != "" {
		return nil
	}

	go func(keyID string) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("Panic during user last seen sync", "err", err)
			}
		}()

		id, err := strconv.ParseInt(keyID, 10, 64)
		if err != nil {
			s.log.Warn("Invalid api key id", "id", keyID, "err", err)
			return
		}

		if err := s.apiKeyService.UpdateAPIKeyLastUsedDate(context.Background(), id); err != nil {
			s.log.Warn("Failed to update last used date for api key", "id", keyID, "err", err)
			return
		}
	}(r.GetMeta(metaKeyID))

	return nil
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

func validateApiKey(orgID int64, key *apikey.APIKey) error {
	if key.Expires != nil && *key.Expires <= time.Now().Unix() {
		return errAPIKeyExpired.Errorf("API key has expired")
	}

	if key.IsRevoked != nil && *key.IsRevoked {
		return errAPIKeyRevoked.Errorf("Api key is revoked")
	}

	if orgID != key.OrgID {
		return errAPIKeyOrgMismatch.Errorf("API does not belong in Organization")
	}

	return nil
}

func newAPIKeyIdentity(key *apikey.APIKey) *authn.Identity {
	return &authn.Identity{
		ID:              strconv.FormatInt(key.ID, 10),
		Type:            claims.TypeAPIKey,
		OrgID:           key.OrgID,
		OrgRoles:        map[int64]org.RoleType{key.OrgID: key.Role},
		ClientParams:    authn.ClientParams{SyncPermissions: true},
		AuthenticatedBy: login.APIKeyAuthModule,
	}
}

func newServiceAccountIdentity(key *apikey.APIKey) *authn.Identity {
	return &authn.Identity{
		ID:              strconv.FormatInt(*key.ServiceAccountId, 10),
		Type:            claims.TypeServiceAccount,
		OrgID:           key.OrgID,
		AuthenticatedBy: login.APIKeyAuthModule,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
	}
}

func shouldUpdateLastUsedAt(key *apikey.APIKey) bool {
	return key.LastUsedAt == nil || time.Since(*key.LastUsedAt) > 5*time.Minute
}
