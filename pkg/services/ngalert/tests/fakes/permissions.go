package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
)

type FakeReceiverPermissionsService struct {
	*actest.FakePermissionsService
}

func NewFakeReceiverPermissionsService() *FakeReceiverPermissionsService {
	return &FakeReceiverPermissionsService{
		FakePermissionsService: &actest.FakePermissionsService{},
	}
}

func (f FakeReceiverPermissionsService) SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, uid string) {
}

var _ accesscontrol.ReceiverPermissionsService = new(FakeReceiverPermissionsService)
