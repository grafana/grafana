package object

func (x *GRN) Equals(b *GRN) bool {
	if x == b {
		return true
	}
	if b == nil {
		return false
	}
	return x.TenantId == b.TenantId &&
		x.Scope == b.Scope &&
		x.Kind == b.Kind &&
		x.UID == b.UID
}
