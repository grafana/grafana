package orgusertest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/orguser"
)

type FakeOrgUserService struct {
	ExpectedOrgUserID int64
	ExpectedError     error
}

func NewOrgUserServiceFake() *FakeOrgUserService {
	return &FakeOrgUserService{}
}

func (f *FakeOrgUserService) Insert(ctx context.Context, cmd *orguser.OrgUser) (int64, error) {
	return f.ExpectedOrgUserID, f.ExpectedError
}
