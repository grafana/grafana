package identity

import (
	"fmt"
	"strconv"
	"strings"
)

type Namespace string

const (
	NamespaceUser           Namespace = "user"
	NamespaceAPIKey         Namespace = "api-key"
	NamespaceServiceAccount Namespace = "service-account"
	NamespaceAnonymous      Namespace = "anonymous"
	NamespaceRenderService  Namespace = "render"
	NamespaceAccessPolicy   Namespace = "access-policy"
	NamespaceProvisioning   Namespace = "provisioning"
	NamespaceEmpty          Namespace = ""
)

func (n Namespace) String() string {
	return string(n)
}

func ParseNamespace(str string) (Namespace, error) {
	switch str {
	case string(NamespaceUser):
		return NamespaceUser, nil
	case string(NamespaceAPIKey):
		return NamespaceAPIKey, nil
	case string(NamespaceServiceAccount):
		return NamespaceServiceAccount, nil
	case string(NamespaceAnonymous):
		return NamespaceAnonymous, nil
	case string(NamespaceRenderService):
		return NamespaceRenderService, nil
	case string(NamespaceAccessPolicy):
		return NamespaceAccessPolicy, nil
	default:
		return "", ErrInvalidNamespaceID.Errorf("got invalid namespace %s", str)
	}
}

var AnonymousNamespaceID = NewNamespaceID(NamespaceAnonymous, 0)

func ParseNamespaceID(str string) (NamespaceID, error) {
	var namespaceID NamespaceID

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return namespaceID, ErrInvalidNamespaceID.Errorf("expected namespace id to have 2 parts")
	}

	namespace, err := ParseNamespace(parts[0])
	if err != nil {
		return namespaceID, err
	}

	namespaceID.id = parts[1]
	namespaceID.namespace = namespace

	return namespaceID, nil
}

// MustParseNamespaceID parses namespace id, it will panic if it fails to do so.
// Suitable to use in tests or when we can guarantee that we pass a correct format.
func MustParseNamespaceID(str string) NamespaceID {
	namespaceID, err := ParseNamespaceID(str)
	if err != nil {
		panic(err)
	}
	return namespaceID
}

func NewNamespaceID(namespace Namespace, id int64) NamespaceID {
	return NamespaceID{
		id:        strconv.FormatInt(id, 10),
		namespace: namespace,
	}
}

// NewNamespaceIDString creates a new NamespaceID with a string id
func NewNamespaceIDString(namespace Namespace, id string) NamespaceID {
	return NamespaceID{
		id:        id,
		namespace: namespace,
	}
}

// FIXME: use this instead of encoded string through the codebase
type NamespaceID struct {
	id        string
	namespace Namespace
}

func (ni NamespaceID) ID() string {
	return ni.id
}

// UserID will try to parse and int64 identifier if namespace is either user or service-account.
// For all other namespaces '0' will be returned.
func (ni NamespaceID) UserID() (int64, error) {
	if ni.IsNamespace(NamespaceUser, NamespaceServiceAccount) {
		return ni.ParseInt()
	}
	return 0, nil
}

// ParseInt will try to parse the id as an int64 identifier.
func (ni NamespaceID) ParseInt() (int64, error) {
	return strconv.ParseInt(ni.id, 10, 64)
}

func (ni NamespaceID) Namespace() Namespace {
	return ni.namespace
}

func (ni NamespaceID) IsNamespace(expected ...Namespace) bool {
	return IsNamespace(ni.namespace, expected...)
}

func (ni NamespaceID) String() string {
	return fmt.Sprintf("%s:%s", ni.namespace, ni.id)
}
