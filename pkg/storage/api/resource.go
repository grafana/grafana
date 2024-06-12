package api

import (
	"bytes"
	"fmt"
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

	if x.ResourceVersion > 0 {
		buffer.WriteString("/")
		buffer.WriteString(fmt.Sprintf("%.20d", x.ResourceVersion))
	}
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
