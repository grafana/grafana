package identity

import (
	"fmt"

	"github.com/grafana/authlib/claims"
)

func NewTypedID(t claims.IdentityType, id int64) string {
	return fmt.Sprintf("%s:%d", t, id)
}

// NewTypedIDString creates a new TypedID with a string id
func NewTypedIDString(t claims.IdentityType, id string) string {
	return fmt.Sprintf("%s:%s", t, id)
}
