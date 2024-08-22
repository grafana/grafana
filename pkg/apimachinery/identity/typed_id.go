package identity

import (
	"fmt"
	"strings"

	"github.com/grafana/authlib/claims"
)

func ParseTypeAndID(str string) (claims.IdentityType, string, error) {
	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return "", "", ErrInvalidTypedID.Errorf("expected typed id to have 2 parts")
	}

	t, err := claims.ParseType(parts[0])
	if err != nil {
		return "", "", err
	}

	return t, parts[1], nil
}

func NewTypedID(t claims.IdentityType, id int64) string {
	return fmt.Sprintf("%s:%d", t, id)
}

// NewTypedIDString creates a new TypedID with a string id
func NewTypedIDString(t claims.IdentityType, id string) string {
	return fmt.Sprintf("%s:%s", t, id)
}
