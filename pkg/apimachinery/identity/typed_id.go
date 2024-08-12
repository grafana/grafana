package identity

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/authlib/claims"
)

// IsIdentityType returns true if typedID matches any expected identity type
func IsIdentityType(typedID TypedID, expected ...claims.IdentityType) bool {
	for _, e := range expected {
		if typedID.Type() == e {
			return true
		}
	}

	return false
}

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
func NewTypedIDString(t claims.IdentityType, id string) TypedID {
	return TypedID{
		id: id,
		t:  t,
	}
}

// FIXME: use this instead of encoded string through the codebase
type TypedID struct {
	id string
	t  claims.IdentityType
}

func (ni TypedID) ID() string {
	return ni.id
}

// UserID will try to parse and int64 identifier if namespace is either user or service-account.
// For all other namespaces '0' will be returned.
func (ni TypedID) UserID() (int64, error) {
	if ni.IsType(claims.TypeUser, claims.TypeServiceAccount) {
		return ni.ParseInt()
	}
	return 0, nil
}

// ParseInt will try to parse the id as an int64 identifier.
func (ni TypedID) ParseInt() (int64, error) {
	return strconv.ParseInt(ni.id, 10, 64)
}

func (ni TypedID) Type() claims.IdentityType {
	return ni.t
}

func (ni TypedID) IsType(expected ...claims.IdentityType) bool {
	return IsIdentityType(ni, expected...)
}

func (ni TypedID) String() string {
	return fmt.Sprintf("%s:%s", ni.t, ni.id)
}
