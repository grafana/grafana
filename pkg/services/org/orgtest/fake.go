package orgtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/org"
)

type FakeOrgService struct {
	ExpectedOrgUserID  int64
	ExpectedError      error
	ExpectedUserOrgDTO []*org.UserOrgDTO
	ExpectedOrgs       []*org.OrgDTO
	ExpectedOrg        *org.Org
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

func (f *FakeOrgService) GetByID(ctx context.Context, query *org.GetOrgByIdQuery) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) GetByNameHandler(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) GetByName(name string) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) CreateWithMember(name string, userID int64) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}
func (f *FakeOrgService) Create(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	return f.ExpectedOrg, f.ExpectedError
}

func (f *FakeOrgService) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return f.ExpectedError
}

func (f *FakeOrgService) GetOrCreate(ctx context.Context, orgName string) (int64, error) {
	return 0, f.ExpectedError
}
