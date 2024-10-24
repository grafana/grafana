package resource

import (
	"fmt"
	"strings"
)

func matchesQueryKey(query *ResourceKey, key *ResourceKey) bool {
	if query.Group != key.Group {
		return false
	}
	if query.Resource != key.Resource {
		return false
	}
	if query.Namespace != "" && query.Namespace != key.Namespace {
		return false
	}
	if query.Name != "" && query.Name != key.Name {
		return false
	}
	return true
}

func toStringKey(k *ResourceKey) string {
	return fmt.Sprintf("%s/%s/%s/%s", k.Group, k.Resource, k.Namespace, k.Name)
}

func keyFromString(k string) (*ResourceKey, error) {
	parts := strings.Split(k, "/")
	if len(parts) != 4 {
		return nil, fmt.Errorf("expecting key with 4 parts")
	}
	return &ResourceKey{
		Group:     parts[0],
		Resource:  parts[1],
		Namespace: parts[2],
		Name:      parts[3],
	}, nil
}
