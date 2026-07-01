package nats

// Enabler is the capability shared by a Publisher and a Subscriber: reporting
// whether NATS is enabled for it. Both embed it, so callers can gate on either
// transport with the nil-safe Enabled helper.
type Enabler interface {
	Enabled() bool
}

// Enabled reports whether e is present and enabled. It is nil-safe (a nil
// Enabler is not enabled), so callers choose between the NATS path and a
// fallback without repeating the check — for a Subscriber or a Publisher alike.
func Enabled(e Enabler) bool {
	return e != nil && e.Enabled()
}
