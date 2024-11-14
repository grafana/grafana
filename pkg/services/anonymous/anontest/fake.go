package anontest

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
)

type FakeService struct {
	ExpectedCountDevices int64
	ExpectedListDevices  []*anonstore.Device
	ExpectedError        error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

func (f *FakeService) TagDevice(ctx context.Context, httpReq *http.Request, kind anonymous.DeviceKind) error {
	return f.ExpectedError
}

func (f *FakeService) CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error) {
	return f.ExpectedCountDevices, f.ExpectedError
}

func (f *FakeService) ListDevices(ctx context.Context, from *time.Time, to *time.Time) ([]*anonstore.Device, error) {
	return f.ExpectedListDevices, f.ExpectedError
}
