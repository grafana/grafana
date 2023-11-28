package anonymous

import (
	"context"
	"net/http"
)

type DeviceKind string

const (
	AnonDeviceUI DeviceKind = "ui-anon-session"
)

type Service interface {
	TagDevice(context.Context, *http.Request, DeviceKind) error
}
