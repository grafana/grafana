package anontest

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/anonymous"
)

type FakeService struct {
	ExpectedCountDevices int64
	ExpectedError        error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

type FakeAnonymousSessionService struct {
}

func (f *FakeService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	return nil
}

func (f *FakeService) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	return f.ExpectedCountDevices, nil
}
