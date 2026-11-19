package resource

import (
	"fmt"
	"strconv"
	"strings"
)

type DataAction string

const (
	DataActionCreated DataAction = "created"
	DataActionUpdated DataAction = "updated"
	DataActionDeleted DataAction = "deleted"
)

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          DataAction
	Folder          string
}

// ParseDataKeyParts parses the common parts of a data key.
// Keys are either 4 parts (cluster-scoped: group/resource/name/rvMeta)
// or 5 parts (namespaced: group/resource/namespace/name/rvMeta).
func ParseDataKeyParts(parts []string) (DataKey, []string, error) {
	var dk DataKey
	var rvMeta string
	switch len(parts) {
	case 4: // cluster-scoped: group/resource/name/rvMeta
		dk.Group = parts[0]
		dk.Resource = parts[1]
		dk.Name = parts[2]
		rvMeta = parts[3]
	case 5: // namespaced: group/resource/namespace/name/rvMeta
		dk.Group = parts[0]
		dk.Resource = parts[1]
		dk.Namespace = parts[2]
		dk.Name = parts[3]
		rvMeta = parts[4]
	default:
		return DataKey{}, nil, fmt.Errorf("invalid key: expected 4 or 5 parts, got %d", len(parts))
	}
	rvParts := strings.Split(rvMeta, "~")
	if len(rvParts) < 3 {
		return DataKey{}, nil, fmt.Errorf("invalid resource version metadata: expected at least 3 parts, got %d", len(rvParts))
	}
	rv, err := strconv.ParseInt(rvParts[0], 10, 64)
	if err != nil {
		return DataKey{}, nil, fmt.Errorf("invalid resource version '%s': %w", rvParts[0], err)
	}
	dk.ResourceVersion = rv
	dk.Action = DataAction(rvParts[1])
	dk.Folder = rvParts[2]
	return dk, rvParts, nil
}

func (k DataKey) String() string {
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Name, k.ResourceVersion, k.Action, k.Folder)
	}
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder)
}

func (k DataKey) Equals(other DataKey) bool {
	return k.Group == other.Group && k.Resource == other.Resource && k.Namespace == other.Namespace && k.Name == other.Name && k.ResourceVersion == other.ResourceVersion && k.Action == other.Action && k.Folder == other.Folder
}

// SameResource checks if this key represents the same resource as another key.
// It compares the identifying fields: Group, Resource, Namespace, and Name.
// ResourceVersion, Action, and Folder are ignored as they don't identify the resource itself.
func (k DataKey) SameResource(other DataKey) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name
}
