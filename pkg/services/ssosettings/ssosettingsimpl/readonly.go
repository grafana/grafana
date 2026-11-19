package ssosettingsimpl

import (
	"context"
	"errors"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/database"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/strategies"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// errReadOnly is a status error (405) so writes to this read-only apiserver map
// to Method Not Allowed instead of a generic 500.
var errReadOnly = apierrors.NewMethodNotSupported(iamv0.SSOSettingResourceInfo.GroupResource(), "write")

// readOnlyDBService serves the SSOSetting kind read-only for a standalone
// apiserver: it redacts by field name without decrypting (so it needs no secrets
// service) and rejects writes. Stored rows are served unfiltered; the
// in-process configurable-providers filter needs per-instance config unavailable here.
type readOnlyDBService struct {
	store    ssosettings.Store
	fallback ssosettings.FallbackStrategy
}

var _ ssosettings.Service = (*readOnlyDBService)(nil)

// ProvideReadOnlyDBService provides a read-only service. With a ConfigProvider,
// OAuth reads merge stored rows over the tenant's config. A nil cfgProvider serves
// stored DB rows only.
func ProvideReadOnlyDBService(sql legacysql.LegacyDatabaseProvider, cfgProvider configprovider.ConfigProvider) *readOnlyDBService {
	s := &readOnlyDBService{store: database.ProvideStore(sql)}
	if cfgProvider != nil {
		s.fallback = strategies.NewOAuthStrategy(cfgProvider)
	}
	return s
}

func (s *readOnlyDBService) List(ctx context.Context) ([]*models.SSOSettings, error) {
	stored, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}

	result := stored
	if s.fallback != nil {
		result, err = s.listWithFallback(ctx, stored)
		if err != nil {
			return nil, err
		}
	}

	for _, setting := range result {
		setting.Settings = removeSecrets(setting.Settings)
	}
	return result, nil
}

func (s *readOnlyDBService) listWithFallback(ctx context.Context, stored []*models.SSOSettings) ([]*models.SSOSettings, error) {
	result := make([]*models.SSOSettings, 0, len(ssosettings.AllOAuthProviders)+len(stored))
	// GetProviderConfig reloads every OAuth section on each call.
	// The settings service caches by namespace and selector.
	for _, provider := range ssosettings.AllOAuthProviders {
		system, err := s.fallback.GetProviderConfig(ctx, provider)
		if err != nil {
			return nil, err
		}
		db := getSettingByProvider(provider, stored)
		result = append(result, withFallback(db, provider, system))
	}

	for _, setting := range stored {
		if !slices.Contains(ssosettings.AllOAuthProviders, setting.Provider) {
			result = append(result, setting)
		}
	}
	return result, nil
}

// withFallback merges a stored row over the provider's fallback settings.
func withFallback(stored *models.SSOSettings, provider string, system map[string]any) *models.SSOSettings {
	if stored == nil {
		return &models.SSOSettings{Provider: provider, Source: models.System, Settings: system}
	}
	stored.Settings = mergeSettings(stored.Settings, system)
	return stored
}

func (s *readOnlyDBService) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	return s.List(ctx)
}

func (s *readOnlyDBService) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if s.fallback == nil || !slices.Contains(ssosettings.AllOAuthProviders, provider) {
		setting, err := s.store.Get(ctx, provider)
		if err != nil {
			return nil, err
		}
		setting.Settings = removeSecrets(setting.Settings)
		return setting, nil
	}

	stored, err := s.store.Get(ctx, provider)
	if err != nil && !errors.Is(err, ssosettings.ErrNotFound) {
		return nil, err
	}
	system, err := s.fallback.GetProviderConfig(ctx, provider)
	if err != nil {
		return nil, err
	}

	setting := withFallback(stored, provider, system)
	setting.Settings = removeSecrets(setting.Settings)
	return setting, nil
}

// GetForProvider would decrypt; reads use the redacted variant instead.
func (s *readOnlyDBService) GetForProvider(context.Context, string) (*models.SSOSettings, error) {
	return nil, errReadOnly
}

func (s *readOnlyDBService) GetForProviderFromCache(context.Context, string) (*models.SSOSettings, error) {
	return nil, errReadOnly
}

func (s *readOnlyDBService) Upsert(context.Context, *models.SSOSettings, identity.Requester) error {
	return errReadOnly
}

func (s *readOnlyDBService) Delete(context.Context, string) error {
	return errReadOnly
}

func (s *readOnlyDBService) Patch(context.Context, string, map[string]any, identity.Requester) error {
	return errReadOnly
}

func (s *readOnlyDBService) RegisterReloadable(string, ssosettings.Reloadable) {}

func (s *readOnlyDBService) Reload(context.Context, string) {}

func (s *readOnlyDBService) GetDefaults(string) map[string]any { return nil }
