package authn

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

const (
	NamespaceUser           = identity.NamespaceUser
	NamespaceAPIKey         = identity.NamespaceAPIKey
	NamespaceServiceAccount = identity.NamespaceServiceAccount
	NamespaceAnonymous      = identity.NamespaceAnonymous
	NamespaceRenderService  = identity.NamespaceRenderService
	NamespaceAccessPolicy   = identity.NamespaceAccessPolicy
	AnonymousNamespaceID    = NamespaceAnonymous + ":0"
)

var namespaceLookup = map[string]struct{}{
	NamespaceUser:           {},
	NamespaceAPIKey:         {},
	NamespaceServiceAccount: {},
	NamespaceAnonymous:      {},
	NamespaceRenderService:  {},
	NamespaceAccessPolicy:   {},
}

// NamespacedID builds a namespaced ID from a namespace and an ID.
func NamespacedID(namespace string, id int64) string {
	return fmt.Sprintf("%s:%d", namespace, id)
}

func ParseNamespaceID(str string) (NamespaceID, error) {
	var namespaceID NamespaceID

	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return namespaceID, ErrInvalidNamepsaceID.Errorf("expected namespace id to have 2 parts")
	}

	namespace, id := parts[0], parts[1]

	if _, ok := namespaceLookup[namespace]; !ok {
		return namespaceID, ErrInvalidNamepsaceID.Errorf("got invalid namespace %s", namespace)
	}

	namespaceID.id = id
	namespaceID.namespace = namespace

	return namespaceID, nil
}

// MustParseNamespaceID parses namespace id, it will panic it failes to do so.
// Sutable to use in tests or when we can garantuee that we pass a correct format.
func MustParseNamespaceID(str string) NamespaceID {
	namespaceID, err := ParseNamespaceID(str)
	if err != nil {
		panic(err)
	}
	return namespaceID
}

// FIXME: use this instead of encoded string through the codebase
type NamespaceID struct {
	id        string
	namespace string
}

func (ni NamespaceID) ID() string {
	return ni.id
}

func (ni NamespaceID) ParseInt() (int64, error) {
	return strconv.ParseInt(ni.id, 10, 64)
}

func (ni NamespaceID) Namespace() string {
	return ni.namespace
}

func (ni NamespaceID) IsNamespace(expected ...string) bool {
	return identity.IsNamespace(ni.namespace, expected...)
}

func (ni NamespaceID) String() string {
	return fmt.Sprintf("%s:%s", ni.namespace, ni.id)
}
