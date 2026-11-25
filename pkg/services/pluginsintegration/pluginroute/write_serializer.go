package pluginroute

import (
	"context"
	"io"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type writeSerializer struct {
	runtime.NegotiatedSerializer
	builder       *manifestBuilder
	ctx           context.Context
	gvr           schema.GroupVersionResource
	namespace     string
	validation    string
	conversionErr error
}

func (s *writeSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	var infos []runtime.SerializerInfo
	for _, info := range s.NegotiatedSerializer.SupportedMediaTypes() {
		if info.MediaType != runtime.ContentTypeJSON && info.MediaType != runtime.ContentTypeYAML {
			continue
		}
		info.Serializer = writeDecoder{Serializer: info.Serializer, owner: s, mediaType: info.MediaType}
		info.StrictSerializer = writeDecoder{Serializer: info.StrictSerializer, owner: s, mediaType: info.MediaType}
		infos = append(infos, info)
	}
	return infos
}

func (s *writeSerializer) DecoderToVersion(decoder runtime.Decoder, _ runtime.GroupVersioner) runtime.Decoder {
	// The decoder has already normalized to the URL version. A versioning
	// codec would attempt a second conversion to the scheme's internal version.
	return decoder
}

type writeDecoder struct {
	runtime.Serializer
	owner     *writeSerializer
	mediaType string
}

func (d writeDecoder) Decode(raw []byte, _ *schema.GroupVersionKind, _ runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	s := d.owner
	obj, err := decodeWrite(s.ctx, raw, d.mediaType, s.validation)
	if err != nil {
		return nil, nil, err
	}
	obj, err = s.builder.normalizeWrite(s.ctx, s.namespace, obj, s.gvr, s.builder.writeKind(s.gvr))
	if err != nil {
		if apierrors.IsInternalError(err) {
			s.conversionErr = err
		}
		return nil, nil, err
	}
	// Both the handler's version check and audit encoding describe the
	// normalized object, whose source version was checked before conversion.
	gvk := obj.GroupVersionKind()
	return obj, &gvk, nil
}

func (d writeDecoder) EncodeWithAllocator(obj runtime.Object, w io.Writer, allocator runtime.MemoryAllocator) error {
	if encoder, ok := d.Serializer.(runtime.EncoderWithAllocator); ok {
		return encoder.EncodeWithAllocator(obj, w, allocator)
	}
	return d.Encode(obj, w)
}

// Native create/update handlers classify all decoder errors as bad requests.
// Discard that response after a conversion failure so the caller can write the
// server error once the handler returns, without leaking encoding headers.
type conversionErrorWriter struct {
	http.ResponseWriter
	serializer      *writeSerializer
	discardedHeader http.Header
}

func (w *conversionErrorWriter) Header() http.Header {
	if w.serializer.conversionErr != nil {
		if w.discardedHeader == nil {
			w.discardedHeader = w.ResponseWriter.Header().Clone()
		}
		return w.discardedHeader
	}
	return w.ResponseWriter.Header()
}

func (w *conversionErrorWriter) WriteHeader(code int) {
	if w.serializer.conversionErr == nil {
		w.ResponseWriter.WriteHeader(code)
	}
}

func (w *conversionErrorWriter) Write(data []byte) (int, error) {
	if w.serializer.conversionErr != nil {
		return len(data), nil
	}
	return w.ResponseWriter.Write(data)
}
