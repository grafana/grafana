package anontest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/anonymous"
)

type FakeAnonymousSessionService struct {
}

func (f *FakeAnonymousSessionService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	return nil
}
