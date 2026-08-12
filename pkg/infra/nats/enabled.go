package nats

import "reflect"

// Enabler is the capability shared by a Publisher and a Subscriber: reporting
// whether NATS is enabled for it. Both embed it, so callers can gate on either
// transport with the nil-safe Enabled helper.
type Enabler interface {
	Enabled() bool
}

// Enabled reports whether e is present and enabled. It is nil-safe, so callers
// choose between the NATS path and a fallback without repeating the check — for a
// Subscriber or a Publisher alike. Both a nil interface and a typed-nil pointer
// (a non-nil interface holding a nil *SubscriberService/*PublisherService, which
// would panic on the method call) count as not enabled.
func Enabled(e Enabler) bool {
	if e == nil {
		return false
	}
	if v := reflect.ValueOf(e); v.Kind() == reflect.Pointer && v.IsNil() {
		return false
	}
	return e.Enabled()
}
