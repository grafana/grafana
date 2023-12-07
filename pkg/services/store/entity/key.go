package entity

import (
	"fmt"
	"strings"
)

type Key struct {
	Group       string
	Resource    string
	Namespace   string
	Name        string
	Subresource string
}

func ParseKey(key string) (*Key, error) {
	// /<group>/<resource>/<namespace>/<name>(/<subresource>)
	parts := strings.SplitN(key, "/", 6)
	if len(parts) != 5 && len(parts) != 6 {
		return nil, fmt.Errorf("invalid key (expecting 4 or 5 parts) " + key)
	}

	if parts[0] != "" {
		return nil, fmt.Errorf("invalid key (expecting leading slash) " + key)
	}

	k := &Key{
		Group:     parts[1],
		Resource:  parts[2],
		Namespace: parts[3],
		Name:      parts[4],
	}

	if len(parts) == 6 {
		k.Subresource = parts[5]
	}

	return k, nil
}

func (k *Key) String() string {
	if len(k.Subresource) > 0 {
		return fmt.Sprintf("/%s/%s/%s/%s/%s", k.Group, k.Resource, k.Namespace, k.Name, k.Subresource)
	}
	return fmt.Sprintf("/%s/%s/%s/%s", k.Group, k.Resource, k.Namespace, k.Name)
}

func (k *Key) IsEqual(other *Key) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name &&
		k.Subresource == other.Subresource
}
