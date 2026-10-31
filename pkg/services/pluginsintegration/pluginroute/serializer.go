package pluginroute

import (
	"io"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// kindPreservingSerializer encodes unstructured objects and lists under the kind
// they carry. Every manifest kind is registered as the same Go type (and every
// list kind as another), and the scheme converts an unstructured object to the
// first kind registered for its type in the target version. Without this, a list
// of any kind but the first, or an object read through another version, is
// named after the first kind.
type kindPreservingSerializer struct {
	runtime.NegotiatedSerializer
}

func (s kindPreservingSerializer) EncoderForVersion(encoder runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return kindPreservingEncoder{
		Encoder: s.NegotiatedSerializer.EncoderForVersion(encoder, gv),
		raw:     encoder,
		target:  gv,
	}
}

type kindPreservingEncoder struct {
	runtime.Encoder
	raw    runtime.Encoder
	target runtime.GroupVersioner
}

func (e kindPreservingEncoder) Encode(obj runtime.Object, w io.Writer) error {
	if _, ok := obj.(runtime.Unstructured); !ok || e.target == nil {
		return e.Encoder.Encode(obj, w)
	}
	objectKind := obj.GetObjectKind()
	old := objectKind.GroupVersionKind()
	if old.Kind == "" {
		return e.Encoder.Encode(obj, w)
	}
	gvk, ok := e.target.KindForGroupVersionKinds([]schema.GroupVersionKind{old})
	if !ok {
		return e.Encoder.Encode(obj, w)
	}
	// Converting between unstructured objects is a straight copy of the content,
	// list items included, so only the kind needs setting.
	objectKind.SetGroupVersionKind(gvk)
	defer objectKind.SetGroupVersionKind(old)
	return e.raw.Encode(obj, w)
}
