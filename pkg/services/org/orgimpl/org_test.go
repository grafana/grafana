package orgimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestOrgService(t *testing.T) {
	orgStore := newOrgStoreFake()
	orgService := Service{
		store: orgStore,
		cfg:   setting.NewCfg(),
	}

	t.Run("create org", func(t *testing.T) {
		_, err := orgService.GetIDForNewUser(context.Background(), org.GetOrgIDForNewUserCommand{})
		require.NoError(t, err)
	})

	t.Run("create org", func(t *testing.T) {
		_, err := orgService.GetIDForNewUser(context.Background(), org.GetOrgIDForNewUserCommand{})
		require.NoError(t, err)
	})

	t.Run("create org with auto assign org ID", func(t *testing.T) {
		setting.AutoAssignOrg = true
		setting.AutoAssignOrgId = 1
		orgStore.ExpectedOrgID = 1
		orgStore.ExpectedOrg = &org.Org{}
		_, err := orgService.GetIDForNewUser(context.Background(), org.GetOrgIDForNewUserCommand{})
		require.NoError(t, err)
	})

	t.Run("create org with auto assign org ID and orgID", func(t *testing.T) {
		setting.AutoAssignOrg = true
		setting.AutoAssignOrgId = 1
		orgStore.ExpectedOrgID = 1
		orgStore.ExpectedOrg = &org.Org{}
		_, err := orgService.GetIDForNewUser(context.Background(), org.GetOrgIDForNewUserCommand{OrgID: 1})
		require.NoError(t, err)
	})

	setting.AutoAssignOrg = false
	setting.AutoAssignOrgId = 0
}

type FakeOrgStore struct {
	ExpectedOrg    *org.Org
	ExpectedOrgID  int64
	ExpectedUserID int64
	ExpectedError  error
}

func newOrgStoreFake() *FakeOrgStore {
	return &FakeOrgStore{}
}

func (f *FakeOrgStore) Get(ctx context.Context, orgID int64) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgStore) Insert(ctx context.Context, org *org.Org) (int64, error) {
	return f.ExpectedOrgID, f.ExpectedError
}

func (f *FakeOrgStore) InsertUser(ctx context.Context, org *org.OrgUser) (int64, error) {
	return f.ExpectedUserID, f.ExpectedError
}
