package quotaimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestQuotaService(t *testing.T) {
	quotaStore := &FakeQuotaStore{}
	quotaService := Service{
		store: quotaStore,
	}

	t.Run("delete quota", func(t *testing.T) {
		err := quotaService.DeleteByUser(context.Background(), 1)
		require.NoError(t, err)
	})
}

type FakeQuotaStore struct {
	ExpectedError error
}

func (f *FakeQuotaStore) DeleteByUser(ctx context.Context, userID int64) error {
	return f.ExpectedError
}
