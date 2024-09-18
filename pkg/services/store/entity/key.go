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
	// /<group>/<resource>[/namespaces/<namespace>][/<name>[/<subresource>]]
	parts := strings.Split(key, "/")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid key (expecting at least 2 parts): %s", key)
	}

	if parts[0] != "" {
		return nil, fmt.Errorf("invalid key (expecting leading slash): %s", key)
	}

	k := &Key{
		Group:    parts[1],
		Resource: parts[2],
	}

	if len(parts) == 3 {
		return k, nil
	}

	if parts[3] != "namespaces" {
		k.Name = parts[3]
		if len(parts) > 4 {
			k.Subresource = strings.Join(parts[4:], "/")
		}
		return k, nil
	}

	if len(parts) < 5 {
		return nil, fmt.Errorf("invalid key (expecting namespace after 'namespaces'): %s", key)
	}

	k.Namespace = parts[4]

	if len(parts) == 5 {
		return k, nil
	}

	k.Name = parts[5]
	if len(parts) > 6 {
		k.Subresource = strings.Join(parts[6:], "/")
	}

	return k, nil
}

func (k *Key) String() string {
	s := "/" + k.Group + "/" + k.Resource
	if len(k.Namespace) > 0 {
		s += "/namespaces/" + k.Namespace
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
