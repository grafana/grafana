package anonymous

import (
	"context"
	"net/http"
)

type DeviceKind string

const (
	AnonDevice     DeviceKind = "anon-session"
	AuthedDevice   DeviceKind = "authed-session"
	AnonDeviceUI   DeviceKind = "ui-anon-session"
	AuthedDeviceUI DeviceKind = "ui-authed-session"
)

type Service interface {
	TagDevice(context.Context, *http.Request, DeviceKind) error
}
