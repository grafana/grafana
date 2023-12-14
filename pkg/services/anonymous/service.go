package anonymous

import (
	"context"
	"net/http"
	"time"
)

type DeviceKind string

const (
	AnonDeviceUI DeviceKind = "ui-anon-session"
)

type Service interface {
	TagDevice(context.Context, *http.Request, DeviceKind) error
	CountDevices(ctx context.Context, from time.Time, to time.Time) (int64, error)
}
