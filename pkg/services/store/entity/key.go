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

	// Everything after resource is optional
	// /<group>/<resource>/[<namespace>]/[<name>]/[<subresource>]
	parts := strings.SplitN(key, "/", 6)
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid key (expecting at least 2 parts): %s", key)
	}

	if parts[0] != "" {
		return nil, fmt.Errorf("invalid key (expecting leading slash): %s", key)
	}

	if len(parts) > 3 {
		k := &Key{
			Group:     parts[1],
			Resource:  parts[2],
			Namespace: parts[3],
		}

		if len(parts) > 4 {
			k.Name = parts[4]
		}

		if len(parts) > 5 {
			k.Subresource = parts[5]
		}

		return k, nil
	} else {
		return &Key{
			Group:    parts[1],
			Resource: parts[2],
		}, nil
	}
}

func (k *Key) String() string {
	s := "/" + k.Group + "/" + k.Resource

	if len(k.Namespace) > 0 {
		s += "/" + k.Namespace
	}

	if len(k.Name) > 0 {
		s += "/" + k.Name
		if len(k.Subresource) > 0 {
			s += "/" + k.Subresource
		}
	}
	return s
}

func (k *Key) IsEqual(other *Key) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name &&
		k.Subresource == other.Subresource
}
