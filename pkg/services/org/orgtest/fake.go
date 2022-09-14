package orgtest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/org"
)

type FakeOrgService struct {
	ExpectedOrgUserID  int64
	ExpectedError      error
	ExpectedUserOrgDTO []*org.UserOrgDTO
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
