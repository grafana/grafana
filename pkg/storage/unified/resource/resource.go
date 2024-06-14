package resource

import (
	"bytes"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// NamespacedPath is a path that can be used to isolate tenant data
// NOTE: this strategy does not allow quickly searching across namespace boundaries with a prefix
func (x *ResourceKey) NamespacedPath() string {
	var buffer bytes.Buffer
	if x.Namespace == "" {
		buffer.WriteString("__cluster__")
	} else {
		buffer.WriteString(x.Namespace)
	}
	if x.Group == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Group)

	if x.Resource == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Resource)

	if x.Name == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Name)
	return buffer.String()
}

// Return a copy without the resource version
func (x *ResourceKey) WithoutResourceVersion() *ResourceKey {
	return &ResourceKey{
		Namespace: x.Namespace,
		Group:     x.Group,
		Resource:  x.Resource,
		Name:      x.Name,
	}
}

func ResourceKeyFor(gr schema.GroupResource, obj metav1.Object) *ResourceKey {
	return &ResourceKey{
		Group:     gr.Group,
		Resource:  gr.Resource,
		Namespace: obj.GetNamespace(),
		Name:      obj.GetName(),
	}
}
