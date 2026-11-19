package folder

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// groupRouter sends each request to the server of its API group, since folders and dashboards are
// served by different apiservers. A group with no server of its own goes to the fallback.
type groupRouter struct {
	byGroup  map[string]dynamic.Interface
	fallback dynamic.Interface
}

var _ dynamic.Interface = groupRouter{}

func (r groupRouter) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	if c, ok := r.byGroup[gvr.Group]; ok {
		return c.Resource(gvr)
	}
	return r.fallback.Resource(gvr)
}
