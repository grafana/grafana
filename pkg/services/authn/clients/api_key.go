package clients

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/contracts"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
	"github.com/grafana/grafana/pkg/util"
)

var (
	errAPIKeyInvalid     = errutil.Unauthorized("api-key.invalid", errutil.WithPublicMessage("Invalid API key"))
	errAPIKeyExpired     = errutil.Unauthorized("api-key.expired", errutil.WithPublicMessage("Expired API key"))
	errAPIKeyRevoked     = errutil.Unauthorized("api-key.revoked", errutil.WithPublicMessage("Revoked API key"))
	errAPIKeyOrgMismatch = errutil.Unauthorized("api-key.organization-mismatch", errutil.WithPublicMessage("API key does not belong to the requested organization"))
)

var (
	_ authn.HookClient         = new(APIKey)
	_ authn.ContextAwareClient = new(APIKey)
)

const (
	metaKeyID           = "keyID"
	metaKeySkipLastUsed = "keySkipLastUsed"

	// defaultOrgID scopes the token lookup when the request carries no org.
	defaultOrgID = 1
)

func ProvideAPIKey(apiKeyService apikey.Service, tokenStorage contracts.TokenFetcher, tracer trace.Tracer) *APIKey {
	return &APIKey{
		log:           log.New(authn.ClientAPIKey),
		apiKeyService: apiKeyService,
		tokenStorage:  tokenStorage,
		tracer:        tracer,
	}
}

type APIKey struct {
	log           log.Logger
	apiKeyService apikey.Service
	tokenStorage  contracts.TokenFetcher
	tracer        trace.Tracer
}

func (s *APIKey) Name() string {
	return authn.ClientAPIKey
}

func (s *APIKey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	ctx, span := s.tracer.Start(ctx, "authn.apikey.Authenticate")
	defer span.End()
	key, lastUsedID, err := s.getAPIKey(ctx, r.OrgID, getTokenFromRequest(r))
	if err != nil {
		if errors.Is(err, satokengen.ErrInvalidApiKey) {
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

	// Set the opaque last used handle so the hook can stamp the token.
	r.SetMeta(metaKeyID, lastUsedID)
	if !shouldUpdateLastUsedAt(key) {
		// Hack to just have some value, we will check this key in the hook
		// and if its not an empty string we will not update last used.
		r.SetMeta(metaKeySkipLastUsed, "true")
	}

	return newServiceAccountIdentity(key), nil
}

func (s *APIKey) IsEnabled() bool {
	return true
}

// getAPIKey returns the key and an opaque handle for the last used update.
func (s *APIKey) getAPIKey(ctx context.Context, orgID int64, token string) (*apikey.APIKey, string, error) {
	ctx, span := s.tracer.Start(ctx, "authn.apikey.getAPIKey")
	defer span.End()

	if !strings.HasPrefix(token, satokengen.GrafanaPrefix) {
		key, err := s.getFromTokenLegacy(ctx, token)
		if err != nil {
			return nil, "", err
		}
		return key, strconv.FormatInt(key.ID, 10), nil
	}

	return s.getFromToken(ctx, orgID, token)
}

func (s *APIKey) getFromToken(ctx context.Context, orgID int64, token string) (*apikey.APIKey, string, error) {
	ctx, span := s.tracer.Start(ctx, "authn.apikey.getFromToken")
	defer span.End()
	decoded, err := satokengen.Decode(token)
	if err != nil {
		return nil, "", err
	}

	hash, err := decoded.Hash()
	if err != nil {
		return nil, "", err
	}

	// Use the effective org so the identity carries one even when the request did not.
	ns := namespaceForOrg(orgID)
	info, err := s.tokenStorage.GetByHash(ctx, ns, hash)
	if err != nil {
		if errors.Is(err, satoken.ErrTokenNotFound) {
			return nil, "", satokengen.ErrInvalidApiKey
		}
		return nil, "", err
	}

	return apiKeyFromToken(ns.OrgID, info), info.LastUsedID, nil
}

// namespaceForOrg builds the namespace the token store is scoped by.
func namespaceForOrg(orgID int64) claims.NamespaceInfo {
	if orgID == 0 {
		orgID = defaultOrgID
	}
	return claims.NamespaceInfo{Value: claims.OrgNamespaceFormatter(orgID), OrgID: orgID}
}

// apiKeyFromToken maps the storage result onto the legacy shape the rest of this
// client works with.
func apiKeyFromToken(orgID int64, info *contracts.TokenInfo) *apikey.APIKey {
	serviceAccountID := info.ServiceAccountID
	return &apikey.APIKey{
		ID:               info.ID,
		OrgID:            orgID,
		Name:             info.Token.Name,
		Expires:          info.Token.Expires,
		LastUsedAt:       info.Token.LastUsedAt,
		IsRevoked:        info.Token.IsRevoked,
		ServiceAccountId: &serviceAccountID,
	}
}

func (s *APIKey) getFromTokenLegacy(ctx context.Context, token string) (*apikey.APIKey, error) {
	ctx, span := s.tracer.Start(ctx, "authn.apikey.getFromTokenLegacy")
	defer span.End()
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
		return nil, satokengen.ErrInvalidApiKey
	}

	return key, nil
}

func (s *APIKey) Test(ctx context.Context, r *authn.Request) bool {
	return looksLikeApiKey(getTokenFromRequest(r))
}

func (s *APIKey) Priority() uint {
	return 30
}

func (s *APIKey) Hook(ctx context.Context, identity *authn.Identity, r *authn.Request) error {
	ctx, span := s.tracer.Start(ctx, "authn.apikey.Hook") //nolint:ineffassign,staticcheck
	defer span.End()

	if r.GetMeta(metaKeySkipLastUsed) != "" {
		return nil
	}

	go func(lastUsedID string, orgID int64) {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("Panic during user last seen sync", "err", err)
			}
		}()

		if err := s.tokenStorage.UpdateLastUsedDate(context.Background(), namespaceForOrg(orgID), lastUsedID); err != nil {
			s.log.Warn("Failed to update last used date for api key", "id", lastUsedID, "err", err)
			return
		}
	}(r.GetMeta(metaKeyID), r.OrgID)

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

	// plain API keys are no longer supported so an error is returned if the api key doesn't belong to a service account
	if key.ServiceAccountId == nil || *key.ServiceAccountId < 1 {
		return errAPIKeyInvalid.Errorf("API key does not belong to a service account")
	}

	return nil
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
