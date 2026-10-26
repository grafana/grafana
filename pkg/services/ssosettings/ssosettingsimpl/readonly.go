package ssosettingsimpl

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/database"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// errReadOnly is a status error (405) so writes to this read-only apiserver map
// to Method Not Allowed instead of a generic 500.
var errReadOnly = apierrors.NewMethodNotSupported(iamv0.SSOSettingResourceInfo.GroupResource(), "write")

// readOnlyDBService serves the SSOSetting kind read-only for a standalone
// apiserver: it redacts by field name without decrypting (so it needs no secrets
// or config service) and rejects writes. Stored rows are served unfiltered; the
// in-process configurable-providers filter needs per-instance config unavailable here.
type readOnlyDBService struct {
	store ssosettings.Store
}

var _ ssosettings.Service = (*readOnlyDBService)(nil)

func ProvideReadOnlyDBService(sql legacysql.LegacyDatabaseProvider) *readOnlyDBService {
	return &readOnlyDBService{store: database.ProvideStore(sql)}
}

func (s *readOnlyDBService) List(ctx context.Context) ([]*models.SSOSettings, error) {
	stored, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, setting := range stored {
		setting.Settings = removeSecrets(setting.Settings)
	}
	return stored, nil
}

func (s *readOnlyDBService) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	return s.List(ctx)
}

func (s *readOnlyDBService) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	setting, err := s.store.Get(ctx, provider)
	if err != nil {
		return nil, err
	}
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
