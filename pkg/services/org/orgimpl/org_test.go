package orgimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
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

	t.Run("delete user from all orgs", func(t *testing.T) {
		err := orgService.DeleteUserFromAll(context.Background(), 1)
		require.NoError(t, err)
	})
}

type FakeOrgStore struct {
	ExpectedOrg                       *org.Org
	ExpectedOrgID                     int64
	ExpectedUserID                    int64
	ExpectedError                     error
	ExpectedUserOrgs                  []*org.UserOrgDTO
	ExpectedOrgs                      []*org.OrgDTO
	ExpectedOrgUsers                  []*org.OrgUserDTO
	ExpectedSearchOrgUsersQueryResult *org.SearchOrgUsersQueryResult
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

func (f *FakeOrgStore) InsertOrgUser(ctx context.Context, org *org.OrgUser) (int64, error) {
	return f.ExpectedUserID, f.ExpectedError
}

func (f *FakeOrgStore) DeleteUserFromAll(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) Update(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	return f.ExpectedUserOrgs, f.ExpectedError
}

func (f *FakeOrgStore) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return f.ExpectedOrgs, f.ExpectedError
}

func (f *FakeOrgStore) CreateWithMember(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgStore) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) UpdateOrgUser(ctx context.Context, cmd *org.UpdateOrgUserCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) GetOrgUsers(ctx context.Context, query *org.GetOrgUsersQuery) ([]*org.OrgUserDTO, error) {
	return f.ExpectedOrgUsers, f.ExpectedError
}

func (f *FakeOrgStore) GetByID(ctx context.Context, query *org.GetOrgByIdQuery) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgStore) GetByName(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgStore) SearchOrgUsers(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	return f.ExpectedSearchOrgUsersQueryResult, f.ExpectedError
}

func (f *FakeOrgStore) RemoveOrgUser(ctx context.Context, cmd *org.RemoveOrgUserCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgStore) Count(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error) {
	return nil, nil
}
