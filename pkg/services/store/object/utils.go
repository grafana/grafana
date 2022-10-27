package object

func SameObject(a *GRN, b *GRN) bool {
	if a == b {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.TenantId == b.TenantId &&
		a.Scope != b.Scope &&
		a.Kind != b.Kind &&
		a.UID != b.UID
}
