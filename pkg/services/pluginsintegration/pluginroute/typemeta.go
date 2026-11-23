package pluginroute

import (
	"bytes"
	"encoding/json"
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// typeMetaDefaulting fills a request body's missing apiVersion and kind from
// the endpoint it was sent to.
//
// The JSON decoder already defaults them for typed objects, but for an
// unstructured one it requires both in the body, so a client could write a
// manifest kind only by repeating what the URL says -- unlike every other
// Grafana API. Only absent keys are filled: a body naming another version or
// kind still reaches the handler's checks as written.
type typeMetaDefaulting struct {
	runtime.NegotiatedSerializer
}

func (s typeMetaDefaulting) SupportedMediaTypes() []runtime.SerializerInfo {
	infos := s.NegotiatedSerializer.SupportedMediaTypes()
	out := make([]runtime.SerializerInfo, len(infos))
	for i, info := range infos {
		if info.MediaType == runtime.ContentTypeJSON {
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

func (s typeMetaDefaultingSerializer) Decode(data []byte, defaults *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	if _, ok := into.(*unstructured.Unstructured); ok && defaults != nil {
		data = withTypeMeta(data, *defaults)
	}
	return s.Serializer.Decode(data, defaults, into)
}

// EncodeWithAllocator keeps the wrapped serializer's allocation-saving path,
// which the response writer looks for on the serializer it negotiated.
func (s typeMetaDefaultingSerializer) EncodeWithAllocator(obj runtime.Object, w io.Writer, memAlloc runtime.MemoryAllocator) error {
	if e, ok := s.Serializer.(runtime.EncoderWithAllocator); ok {
		return e.EncodeWithAllocator(obj, w, memAlloc)
	}
	return s.Encode(obj, w)
}

// withTypeMeta adds whichever of apiVersion and kind the JSON object lacks.
// The keys are spliced in rather than the object re-encoded, so the decoder
// still sees the body as sent, duplicate fields included. Anything that is
// not a JSON object is returned unchanged for the decoder to reject.
func withTypeMeta(data []byte, gvk schema.GroupVersionKind) []byte {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil || fields == nil {
		return data
	}
	_, hasAPIVersion := fields["apiVersion"]
	_, hasKind := fields["kind"]
	if hasAPIVersion && hasKind {
		return data
	}

	var prefix bytes.Buffer
	prefix.WriteByte('{')
	add := func(key, value string) {
		if prefix.Len() > 1 {
			prefix.WriteByte(',')
		}
		k, _ := json.Marshal(key)
		v, _ := json.Marshal(value)
		prefix.Write(k)
		prefix.WriteByte(':')
		prefix.Write(v)
	}
	if !hasAPIVersion {
		add("apiVersion", gvk.GroupVersion().String())
	}
	if !hasKind {
		add("kind", gvk.Kind)
	}

	// Unmarshal succeeded on a non-nil map, so the trimmed body starts with '{'.
	rest := bytes.TrimLeft(data, " \t\r\n")[1:]
	if len(fields) > 0 {
		prefix.WriteByte(',')
	}
	return append(prefix.Bytes(), rest...)
}
