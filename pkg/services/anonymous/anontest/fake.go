package anontest

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/anonymous"
)

type FakeAnonymousSessionService struct {
}

func (f *FakeAnonymousSessionService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	return nil
}

func (f *FakeAnonymousSessionService) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	return 0, nil
}
