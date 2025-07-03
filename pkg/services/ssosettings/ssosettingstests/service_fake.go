package ssosettingstests

import (
	context "context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	models "github.com/grafana/grafana/pkg/services/ssosettings/models"
)

var _ ssosettings.Service = (*FakeService)(nil)

type FakeService struct {
	ExpectedSSOSetting          *models.SSOSettings
	ExpectedSSOSettings         []*models.SSOSettings
	ExpectedError               error
	ExpectedReloadablesRegistry map[string]ssosettings.Reloadable

	ActualSSOSettings models.SSOSettings
	ActualPatchData   map[string]any
	ActualProvider    string
	ActualRequester   identity.Requester

	ListFn                              func(ctx context.Context) ([]*models.SSOSettings, error)
	ListWithRedactedSecretsFn           func(ctx context.Context) ([]*models.SSOSettings, error)
	GetForProviderFn                    func(ctx context.Context, provider string) (*models.SSOSettings, error)
	GetForProviderWithRedactedSecretsFn func(ctx context.Context, provider string) (*models.SSOSettings, error)
	UpsertFn                            func(ctx context.Context, settings *models.SSOSettings, requester identity.Requester) error
	DeleteFn                            func(ctx context.Context, provider string) error
	PatchFn                             func(ctx context.Context, provider string, data map[string]any) error
	RegisterReloadableFn                func(provider string, reloadable ssosettings.Reloadable)
	ReloadFn                            func(ctx context.Context, provider string)
}

func NewFakeService() *FakeService {
	return &FakeService{
		ExpectedReloadablesRegistry: make(map[string]ssosettings.Reloadable),
	}
}

func (f *FakeService) List(ctx context.Context) ([]*models.SSOSettings, error) {
	if f.ListFn != nil {
		return f.ListFn(ctx)
	}
	return f.ExpectedSSOSettings, f.ExpectedError
}

func (f *FakeService) ListWithRedactedSecrets(ctx context.Context) ([]*models.SSOSettings, error) {
	if f.ListWithRedactedSecretsFn != nil {
		return f.ListWithRedactedSecretsFn(ctx)
	}
	return f.ExpectedSSOSettings, f.ExpectedError
}

func (f *FakeService) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if f.GetForProviderFn != nil {
		return f.GetForProviderFn(ctx, provider)
	}
	f.ActualProvider = provider
	return f.ExpectedSSOSetting, f.ExpectedError
}

func (f *FakeService) GetForProviderWithRedactedSecrets(ctx context.Context, provider string) (*models.SSOSettings, error) {
	if f.GetForProviderWithRedactedSecretsFn != nil {
		return f.GetForProviderWithRedactedSecretsFn(ctx, provider)
	}
	f.ActualProvider = provider
	return f.ExpectedSSOSetting, f.ExpectedError
}

func (f *FakeService) Upsert(ctx context.Context, settings *models.SSOSettings, requester identity.Requester) error {
	if f.UpsertFn != nil {
		return f.UpsertFn(ctx, settings, requester)
	}

	f.ActualSSOSettings = *settings
	f.ActualRequester = requester

	return f.ExpectedError
}

func (f *FakeService) Delete(ctx context.Context, provider string) error {
	if f.DeleteFn != nil {
		return f.DeleteFn(ctx, provider)
	}

	f.ActualProvider = provider

	return f.ExpectedError
}

func (f *FakeService) Patch(ctx context.Context, provider string, data map[string]any) error {
	if f.PatchFn != nil {
		return f.PatchFn(ctx, provider, data)
	}

	f.ActualProvider = provider
	f.ActualPatchData = data

	return f.ExpectedError
}

func (f *FakeService) RegisterReloadable(provider string, reloadable ssosettings.Reloadable) {
	if f.RegisterReloadableFn != nil {
		f.RegisterReloadableFn(provider, reloadable)
		return
	}

	f.ExpectedReloadablesRegistry[provider] = reloadable
}

func (f *FakeService) Reload(ctx context.Context, provider string) {
	if f.ReloadFn != nil {
		f.ReloadFn(ctx, provider)
		return
	}

	f.ActualProvider = provider
}
