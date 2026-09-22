package ssosettingsimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeReadStore struct {
	getFn  func(ctx context.Context, provider string) (*models.SSOSettings, error)
	listFn func(ctx context.Context) ([]*models.SSOSettings, error)
}

func (f *fakeReadStore) Get(ctx context.Context, provider string) (*models.SSOSettings, error) {
	return f.getFn(ctx, provider)
}
func (f *fakeReadStore) List(ctx context.Context) ([]*models.SSOSettings, error) {
	return f.listFn(ctx)
}
func (f *fakeReadStore) Upsert(context.Context, *models.SSOSettings) error { return nil }
func (f *fakeReadStore) Delete(context.Context, string) error              { return nil }

func TestReadOnlyDBService_GetRedactsWithoutError(t *testing.T) {
	svc := &readOnlyDBService{store: &fakeReadStore{
		getFn: func(_ context.Context, provider string) (*models.SSOSettings, error) {
			return &models.SSOSettings{Provider: provider, Settings: map[string]any{
				"client_id":     "the-id",
				"client_secret": "top-secret",
			}}, nil
		},
	}}

	got, err := svc.GetForProviderWithRedactedSecrets(context.Background(), "github")
	require.NoError(t, err)
	assert.Equal(t, "the-id", got.Settings["client_id"])
	assert.Equal(t, setting.RedactedPassword, got.Settings["client_secret"])
}

func TestReadOnlyDBService_GetNotFoundPropagates(t *testing.T) {
	svc := &readOnlyDBService{store: &fakeReadStore{
		getFn: func(context.Context, string) (*models.SSOSettings, error) {
			return nil, ssosettings.ErrNotFound
		},
	}}

	_, err := svc.GetForProviderWithRedactedSecrets(context.Background(), "missing")
	assert.ErrorIs(t, err, ssosettings.ErrNotFound)
}

func TestReadOnlyDBService_ListRedacts(t *testing.T) {
	svc := &readOnlyDBService{store: &fakeReadStore{
		listFn: func(context.Context) ([]*models.SSOSettings, error) {
			return []*models.SSOSettings{{Provider: "github", Settings: map[string]any{
				"client_id":     "the-id",
				"client_secret": "top-secret",
			}}}, nil
		},
	}}

	got, err := svc.List(context.Background())
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "the-id", got[0].Settings["client_id"])
	assert.Equal(t, setting.RedactedPassword, got[0].Settings["client_secret"])
}

func TestReadOnlyDBService_WritesUnsupported(t *testing.T) {
	svc := &readOnlyDBService{}
	ctx := context.Background()

	// Writes must map to 405 Method Not Allowed, not a generic 500.
	assert.True(t, apierrors.IsMethodNotSupported(svc.Upsert(ctx, &models.SSOSettings{}, identity.Requester(nil))))
	assert.True(t, apierrors.IsMethodNotSupported(svc.Delete(ctx, "github")))
	assert.True(t, apierrors.IsMethodNotSupported(svc.Patch(ctx, "github", nil, identity.Requester(nil))))

	_, err := svc.GetForProvider(ctx, "github")
	assert.True(t, apierrors.IsMethodNotSupported(err))
}
