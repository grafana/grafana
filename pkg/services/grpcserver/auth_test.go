package grpcserver

import (
	"context"
	"testing"

	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func TestAuthenticator_Authenticate(t *testing.T) {
	t.Run("accepts service api key with admin role", func(t *testing.T) {
		s := newFakeSQLStore(&models.ApiKey{
			Id:    1,
			OrgId: 1,
			Role:  models.ROLE_ADMIN,
			Key:   "admin-api-key",
			Name:  "Admin API Key",
		}, nil)
		a := NewAuthenticator(s)
		ctx, err := setupContext()
		require.NoError(t, err)
		ctx, err = a.Authenticate(ctx)
		require.NoError(t, err)
	})

	t.Run("rejects non-admin role", func(t *testing.T) {
		s := newFakeSQLStore(&models.ApiKey{
			Id:    1,
			OrgId: 1,
			Role:  models.ROLE_EDITOR,
			Key:   "admin-api-key",
			Name:  "Admin API Key",
		}, nil)
		a := NewAuthenticator(s)
		ctx, err := setupContext()
		require.NoError(t, err)
		ctx, err = a.Authenticate(ctx)
		require.NotNil(t, err)
	})
}

type fakeSQLStore struct {
	sqlstore.Store
	key *models.ApiKey
	err error
}

func newFakeSQLStore(key *models.ApiKey, err error) *fakeSQLStore {
	return &fakeSQLStore{
		key: key,
		err: err,
	}
}

func (f *fakeSQLStore) GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	return f.key, f.err
}

func setupContext() (context.Context, error) {
	ctx := context.Background()
	key, err := apikeygenprefix.New("sa")
	if err != nil {
		return ctx, err
	}
	md := metadata.New(map[string]string{})
	md["authorization"] = []string{"Bearer " + key.ClientSecret}
	return metadata.NewIncomingContext(ctx, md), nil
}
