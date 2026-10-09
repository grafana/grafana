package contract

import (
	"fmt"
)

type NamespacedResource struct {
	Namespace string
	Group     string
	Resource  string
}

// All fields are set
func (s *NamespacedResource) Valid() bool {
	return s.Namespace != "" && s.Group != "" && s.Resource != ""
}

func (s *NamespacedResource) String() string {
	return fmt.Sprintf("%s/%s", s.Namespace, s.GroupResource())
}

func (s *NamespacedResource) GroupResource() string {
	return fmt.Sprintf("%s/%s", s.Group, s.Resource)
}

const (
	// GlobalSearchGroup and GlobalSearchResource name the index that covers a whole
	// namespace instead of a single resource type. They are not a stored group or
	// resource, so nothing else can claim this pair, which lets a namespace-wide
	// index reuse NamespacedResource for its cache entry, storage paths and
	// ownership. Both have to be non-empty: an empty pair already means "the
	// default document builder".
	GlobalSearchGroup    = "search.grafana.app"
	GlobalSearchResource = "global"
)

// IsGlobal reports whether the key names the namespace-wide index rather than a
// single resource type.
func (s *NamespacedResource) IsGlobal() bool {
	return s.Group == GlobalSearchGroup && s.Resource == GlobalSearchResource
}

// GlobalSearchKey returns the key of a namespace's namespace-wide index.
func GlobalSearchKey(namespace string) NamespacedResource {
	return NamespacedResource{
		Namespace: namespace,
		Group:     GlobalSearchGroup,
		Resource:  GlobalSearchResource,
	}
}
