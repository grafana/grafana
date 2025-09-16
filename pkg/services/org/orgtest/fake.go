package orgtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/org"
)

type OrgListResponse []struct {
	OrgID    int64
	Response error
}

type FakeOrgService struct {
	ExpectedOrgUserID            int64
	ExpectedError                error
	ExpectedUserOrgDTO           []*org.UserOrgDTO
	ExpectedOrgs                 []*org.OrgDTO
	ExpectedOrg                  *org.Org
	ExpectedOrgUsers             []*org.OrgUserDTO
	ExpectedSearchOrgUsersResult *org.SearchOrgUsersQueryResult
	ExpectedOrgListResponse      OrgListResponse
	SearchOrgUsersFn             func(context.Context, *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error)
	InsertOrgUserFn              func(context.Context, *org.OrgUser) (int64, error)
}

func NewOrgServiceFake() *FakeOrgService {
	return &FakeOrgService{}
}

func (f *FakeOrgService) GetIDForNewUser(ctx context.Context, cmd org.GetOrgIDForNewUserCommand) (int64, error) {
	return f.ExpectedOrgUserID, f.ExpectedError
}

func (f *FakeOrgService) Insert(ctx context.Context, cmd *org.OrgUser) (int64, error) {
	return f.ExpectedOrgUserID, f.ExpectedError
}

func (f *FakeOrgService) InsertOrgUser(ctx context.Context, cmd *org.OrgUser) (int64, error) {
	if f.InsertOrgUserFn != nil {
		return f.InsertOrgUserFn(ctx, cmd)
	}
	return f.ExpectedOrgUserID, f.ExpectedError
}

func (f *FakeOrgService) DeleteUserFromAll(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeOrgService) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	return f.ExpectedUserOrgDTO, f.ExpectedError
}

func (f *FakeOrgService) UpdateOrg(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return f.ExpectedOrgs, f.ExpectedError
}

func (f *FakeOrgService) GetByID(ctx context.Context, query *org.GetOrgByIDQuery) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) GetByName(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	for _, expectedOrg := range f.ExpectedOrgs {
		if expectedOrg != nil && expectedOrg.Name == query.Name {
			return &org.Org{ID: expectedOrg.ID, Name: expectedOrg.Name}, nil
		}
	}
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) CreateWithMember(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) GetOrCreate(ctx context.Context, orgName string) (int64, error) {
	return f.ExpectedOrg.ID, f.ExpectedError
}

func (f *FakeOrgService) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) UpdateOrgUser(ctx context.Context, cmd *org.UpdateOrgUserCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) GetOrgUsers(ctx context.Context, query *org.GetOrgUsersQuery) ([]*org.OrgUserDTO, error) {
	return f.ExpectedOrgUsers, f.ExpectedError
}

func (f *FakeOrgService) RemoveOrgUser(ctx context.Context, cmd *org.RemoveOrgUserCommand) error {
	testData := f.ExpectedOrgListResponse[0]
	f.ExpectedOrgListResponse = f.ExpectedOrgListResponse[1:]
	return testData.Response
}

func (f *FakeOrgService) SearchOrgUsers(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	if f.SearchOrgUsersFn != nil {
		return f.SearchOrgUsersFn(ctx, query)
	}
	return f.ExpectedSearchOrgUsersResult, f.ExpectedError
}

func (f *FakeOrgService) RegisterDelete(query string) {
}

type FakeOrgDeletionService struct {
	ExpectedError error
}

func NewOrgDeletionServiceFake() *FakeOrgDeletionService {
	return &FakeOrgDeletionService{}
}

func (f *FakeOrgDeletionService) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return f.ExpectedError
}
