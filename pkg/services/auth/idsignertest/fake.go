package idsignertest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

var _ auth.IDSignerService = new(FakeService)

type FakeService struct {
	ExpectedToken string
	ExpectedErr   error
}

func (f *FakeService) SignIdentity(ctx context.Context, id identity.Requester, req *http.Request) (string, error) {
	return f.ExpectedToken, f.ExpectedErr
}
