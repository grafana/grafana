package orguserimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/orguser"
	"github.com/stretchr/testify/require"
)

func TestOrgUserService(t *testing.T) {
	orgUserStore := newOrgUserStoreFake()
	orgUserService := Service{
		store: orgUserStore,
	}

	t.Run("create org user", func(t *testing.T) {
		_, err := orgUserService.Insert(context.Background(), &orguser.OrgUser{})
		require.NoError(t, err)
	})
}

type FakeOrgUserStore struct {
	ExpectedOrgUserID int64
	ExpectedError     error
}

func newOrgUserStoreFake() *FakeOrgUserStore {
	return &FakeOrgUserStore{}
}

func (f *FakeOrgUserStore) Insert(ctx context.Context, org *orguser.OrgUser) (int64, error) {
	return f.ExpectedOrgUserID, f.ExpectedError
}
