package anonymous

import (
	"context"
	"net/http"
)

type DeviceKind string

const (
	AnonDevice   DeviceKind = "anon-session"
	AuthedDevice DeviceKind = "authed-session"
)

type Service interface {
	TagDevice(context.Context, *http.Request, DeviceKind) error
}
