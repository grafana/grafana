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

// Temporary while we need to support unified/sql/backend compatibility.
// Remove once we stop using RvManager in storage_backend.go
func ParseKeyWithGUID(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rvActionFolderGUIDParts := strings.Split(parts[4], "~")
	if len(rvActionFolderGUIDParts) != 4 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(rvActionFolderGUIDParts[0], 10, 64)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid resource version '%s' in key %s: %w", rvActionFolderGUIDParts[0], key, err)
	}
	return DataKey{
		Group:           parts[0],
		Resource:        parts[1],
		Namespace:       parts[2],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          DataAction(rvActionFolderGUIDParts[1]),
		Folder:          rvActionFolderGUIDParts[2],
		GUID:            rvActionFolderGUIDParts[3],
	}, nil
}

func (k DataKey) String() string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, k.Name, k.ResourceVersion, k.Action, k.Folder)
}

// Temporary while we need to support unified/sql/backend compatibility
// Remove once we stop using RvManager in storage_backend.go
func (k DataKey) StringWithGUID() string {
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
