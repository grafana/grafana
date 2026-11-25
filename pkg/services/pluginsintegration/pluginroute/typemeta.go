package pluginroute

import (
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// typeMetaDefaulting decodes JSON and YAML bodies for manifest kinds without
// requiring apiVersion and kind, which the endpoint already names.
//
// The stock decoder defaults them from the endpoint for typed objects but
// insists on both in the body when decoding into an unstructured one, so a
// client could write a manifest kind only by repeating the URL -- unlike every
// other Grafana API. Values the body does carry are kept, so a body naming
// another version or kind still reaches the handler's checks as written.
type typeMetaDefaulting struct {
	runtime.NegotiatedSerializer
}

func (s typeMetaDefaulting) SupportedMediaTypes() []runtime.SerializerInfo {
	infos := s.NegotiatedSerializer.SupportedMediaTypes()
	out := make([]runtime.SerializerInfo, len(infos))
	for i, info := range infos {
		if info.MediaType == runtime.ContentTypeJSON || info.MediaType == runtime.ContentTypeYAML {
			info.Serializer = wrapTypeMetaDefaulting(info.Serializer)
			info.StrictSerializer = wrapTypeMetaDefaulting(info.StrictSerializer)
		}
		out[i] = info
	}
	return out
}

func wrapTypeMetaDefaulting(s runtime.Serializer) runtime.Serializer {
	if s == nil {
		return nil
	}
	return typeMetaDefaultingSerializer{s}
}

type typeMetaDefaultingSerializer struct {
	runtime.Serializer
}

// Decode hands the wrapped decoder an object the scheme does not know, which
// it fills by plain unmarshalling -- YAML conversion, strict field errors and
// integer handling included -- without the kind check it applies to
// unstructured targets. The returned GVK is the body's, with the endpoint's
// filling whatever it left out.
func (s typeMetaDefaultingSerializer) Decode(data []byte, defaults *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	u, ok := into.(*unstructured.Unstructured)
	if !ok || defaults == nil {
		return s.Serializer.Decode(data, defaults, into)
	}
	var content objectMap
	obj, gvk, err := s.Serializer.Decode(data, defaults, &content)
	if obj == nil || content == nil {
		// Not an object (or a fatal error): let the stock path report it.
		return s.Serializer.Decode(data, defaults, into)
	}
	u.SetUnstructuredContent(content)
	u.SetGroupVersionKind(*gvk)
	// A strict decoding error comes with the decoded object, so the handler
	// can still warn rather than fail when the request asked for that.
	return u, gvk, err
}

// EncodeWithAllocator keeps the wrapped serializer's allocation-saving path,
// which the response writer looks for on the serializer it negotiated.
func (s typeMetaDefaultingSerializer) EncodeWithAllocator(obj runtime.Object, w io.Writer, memAlloc runtime.MemoryAllocator) error {
	if e, ok := s.Serializer.(runtime.EncoderWithAllocator); ok {
		return e.EncodeWithAllocator(obj, w, memAlloc)
	}
	return s.Encode(obj, w)
}

// objectMap is a JSON object as a runtime.Object the scheme does not register.
type objectMap map[string]any

func (m *objectMap) GetObjectKind() schema.ObjectKind { return schema.EmptyObjectKind }

func (m *objectMap) DeepCopyObject() runtime.Object {
	out := objectMap(runtime.DeepCopyJSON(*m))
	return &out
}
