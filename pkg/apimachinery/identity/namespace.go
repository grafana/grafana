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
		return "", ErrInvalidTypedID.Errorf("got invalid namespace %s", str)
	}
}

// IsIdentityType returns true if namespace matches any expected namespace
func IsIdentityType(kind IdentityType, expected ...IdentityType) bool {
	for _, e := range expected {
		if kind == e {
			return true
		}
	}

	return false
}

var AnonymousTypedID = NewTypedID(TypeAnonymous, 0)

func ParseTypedID(str string) (TypedID, error) {
	var namespaceID TypedID

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return namespaceID, ErrInvalidTypedID.Errorf("expected namespace id to have 2 parts")
	}

	namespace, err := ParseType(parts[0])
	if err != nil {
		return namespaceID, err
	}

	namespaceID.id = parts[1]
	namespaceID.namespace = namespace

	return namespaceID, nil
}

// MustParseTypedID parses namespace id, it will panic if it fails to do so.
// Suitable to use in tests or when we can guarantee that we pass a correct format.
func MustParseTypedID(str string) TypedID {
	namespaceID, err := ParseTypedID(str)
	if err != nil {
		panic(err)
	}
	return namespaceID
}

func NewTypedID(namespace IdentityType, id int64) TypedID {
	return TypedID{
		id:        strconv.FormatInt(id, 10),
		namespace: namespace,
	}
}

// NewTypedIDString creates a new TypedID with a string id
func NewTypedIDString(namespace IdentityType, id string) TypedID {
	return TypedID{
		id:        id,
		namespace: namespace,
	}
}

// FIXME: use this instead of encoded string through the codebase
type TypedID struct {
	id        string
	namespace IdentityType
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
	return ni.namespace
}

func (ni TypedID) IsType(expected ...IdentityType) bool {
	return IsIdentityType(ni.namespace, expected...)
}

func (ni TypedID) String() string {
	return fmt.Sprintf("%s:%s", ni.namespace, ni.id)
}
