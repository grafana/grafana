package v1

// ReceiversFromSlice builds the domain map from an already wire-shaped receiver slice, deriving identity
// the same way production code does (see NewReceiver). Any Provenance already set on an entry is
// preserved. Intended for use by tests building AMConfigV1 literals.
func ReceiversFromSlice(in []*PostableApiReceiver) map[ResourceUID]PostableApiReceiver {
	out := make(map[ResourceUID]PostableApiReceiver, len(in))
	for _, r := range in {
		m := NewReceiver(r.Name, r.GrafanaManagedReceivers, r.Provenance) // TODO: This probably shouldn't mess with the metadata
		out[m.UID] = m
	}
	return out
}
