package object

// Check if the two GRNs reference to the same object
// we can not use simple `*x == *b` because of the internal settings
func (x *GRN) Equals(b *GRN) bool {
	if b == nil {
		return false
	}
	return x == b || (x.TenantId == b.TenantId &&
		x.Scope == b.Scope &&
		x.Kind == b.Kind &&
		x.UID == b.UID)
}

// TODO: this should interpoerate with the GRN string flavor
