package identity

import (
	"fmt"
	"strconv"
	"strings"
)

type IdentityType string

const (
	TypeUser           IdentityType = "user"
	TypeAPIKey         IdentityType = "api-key"
	TypeServiceAccount IdentityType = "service-account"
	TypeAnonymous      IdentityType = "anonymous"
	TypeRenderService  IdentityType = "render"
	TypeAccessPolicy   IdentityType = "access-policy"
	TypeProvisioning   IdentityType = "provisioning"
	TypeEmpty          IdentityType = ""
)

func (n IdentityType) String() string {
	return string(n)
}

func ParseType(str string) (IdentityType, error) {
	switch str {
	case string(TypeUser):
		return TypeUser, nil
	case string(TypeAPIKey):
		return TypeAPIKey, nil
	case string(TypeServiceAccount):
		return TypeServiceAccount, nil
	case string(TypeAnonymous):
		return TypeAnonymous, nil
	case string(TypeRenderService):
		return TypeRenderService, nil
	case string(TypeAccessPolicy):
		return TypeAccessPolicy, nil
	default:
		return "", ErrInvalidTypedID.Errorf("got invalid identity type %s", str)
	}
}

// IsIdentityType returns true if type matches any expected identity type
func IsIdentityType(typ IdentityType, expected ...IdentityType) bool {
	for _, e := range expected {
		if typ == e {
			return true
		}
	}

	return false
}

var AnonymousTypedID = NewTypedID(TypeAnonymous, 0)

func ParseTypedID(str string) (TypedID, error) {
	var typeID TypedID

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return typeID, ErrInvalidTypedID.Errorf("expected typed id to have 2 parts")
	}

	t, err := ParseType(parts[0])
	if err != nil {
		return typeID, err
	}

	typeID.id = parts[1]
	typeID.t = t

	return typeID, nil
}

// MustParseTypedID parses namespace id, it will panic if it fails to do so.
// Suitable to use in tests or when we can guarantee that we pass a correct format.
func MustParseTypedID(str string) TypedID {
	typeID, err := ParseTypedID(str)
	if err != nil {
		panic(err)
	}
	return typeID
}

func NewTypedID(t IdentityType, id int64) TypedID {
	return TypedID{
		id: strconv.FormatInt(id, 10),
		t:  t,
	}
}

// NewTypedIDString creates a new TypedID with a string id
func NewTypedIDString(t IdentityType, id string) TypedID {
	return TypedID{
		id: id,
		t:  t,
	}
}

// FIXME: use this instead of encoded string through the codebase
type TypedID struct {
	id string
	t  IdentityType
}

func (ni TypedID) ID() string {
	return ni.id
}

// UserID will try to parse and int64 identifier if namespace is either user or service-account.
// For all other namespaces '0' will be returned.
func (ni TypedID) UserID() (int64, error) {
	if ni.IsType(TypeUser, TypeServiceAccount) {
		return ni.ParseInt()
	}
	return 0, nil
}

// ParseInt will try to parse the id as an int64 identifier.
func (ni TypedID) ParseInt() (int64, error) {
	return strconv.ParseInt(ni.id, 10, 64)
}

func (ni TypedID) Type() IdentityType {
	return ni.t
}

func (ni TypedID) IsType(expected ...IdentityType) bool {
	return IsIdentityType(ni.t, expected...)
}

func (ni TypedID) String() string {
	return fmt.Sprintf("%s:%s", ni.t, ni.id)
}
