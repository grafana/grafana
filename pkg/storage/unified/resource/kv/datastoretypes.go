package kv

import (
	"fmt"
	"strconv"
	"strings"
)

// TODO move everything in this file into datastore.go once backwards compatibility with sql/backend is not necessary
// anymore

type DataAction string

const (
	DataActionCreated DataAction = "created"
	DataActionUpdated DataAction = "updated"
	DataActionDeleted DataAction = "deleted"
)

// LegacyActionValue maps the datastore action to the temporary integer encoding
// still used by sql/backend compatibility columns.
// Remove once sqlkv no longer needs to mirror those legacy columns.
func LegacyActionValue(action DataAction) (int64, error) {
	switch action {
	case DataActionCreated:
		return 1, nil
	case DataActionUpdated:
		return 2, nil
	case DataActionDeleted:
		return 3, nil
	default:
		return 0, fmt.Errorf("unknown data action: %q", action)
	}
}

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          DataAction
	Folder          string

	// needed to maintain backwards compatibility with unified/sql
	GUID string
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

// Temporary while we need to support unified/sql/backend compatibility.
// Remove once we stop using RvManager in storage_backend.go
func ParseKeyWithGUID(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	dk, rvParts, err := ParseDataKeyParts(parts)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid key: %s: %w", key, err)
	}
	if len(rvParts) != 4 {
		return DataKey{}, fmt.Errorf("invalid key metadata: expected %d tilde-separated parts, got %d", 4, len(rvParts))
	}
	dk.GUID = rvParts[3]
	return dk, nil
}

func (k DataKey) String() string {
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Name, k.ResourceVersion, k.Action, k.Folder)
	}
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder)
}

// Temporary while we need to support unified/sql/backend compatibility
// Remove once we stop using RvManager in storage_backend.go
func (k DataKey) StringWithGUID() string {
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/%d~%s~%s~%s", k.Group, k.Resource, k.Name, k.ResourceVersion, k.Action, k.Folder, k.GUID)
	}
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder, k.GUID)
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
