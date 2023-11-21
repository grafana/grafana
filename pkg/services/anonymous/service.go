package anonymous

import (
	"context"
	"net/http"
	"time"
)

type DeviceKind string

const (
	AnonDeviceUI DeviceKind = "ui-anon-session"
	ThirtyDays              = 30 * 24 * time.Hour
)

type Service interface {
	TagDevice(context.Context, *http.Request, DeviceKind) error
}
