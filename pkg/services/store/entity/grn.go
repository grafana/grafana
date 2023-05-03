package entity

import (
	"fmt"
)

// Check if the two GRNs reference to the same object
// we can not use simple `*x == *b` because of the internal settings
func (x *GRN) Equals(b *GRN) bool {
	if b == nil {
		return false
	}
	return x == b || (x.TenantId == b.TenantId &&
		x.Kind == b.Kind &&
		x.UID == b.UID)
}

// Set an OID based on the GRN
func (x *GRN) ToGRNString() string {
	return fmt.Sprintf("grn:%d/%s/%s", x.TenantId, x.Kind, x.UID)
}
