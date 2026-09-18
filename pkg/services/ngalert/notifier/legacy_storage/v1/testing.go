package v1

// ReceiversFromSlice builds the domain map from an already wire-shaped receiver slice, keyed by
// ReceiverUID(name). Intended for use by tests building AMConfigV1 literals.
func ReceiversFromSlice(in []*PostableApiReceiver) map[ResourceUID]PostableApiReceiver {
	out := make(map[ResourceUID]PostableApiReceiver, len(in))
	for _, r := range in {
		out[ReceiverUID(r.Name)] = *r
	}
	return out
}
