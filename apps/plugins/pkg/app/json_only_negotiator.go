package app

import (
	"mime"

	"k8s.io/apimachinery/pkg/runtime"
)

// jsonOnlyNegotiatedSerializer wraps a NegotiatedSerializer to only support JSON encoding.
// This prevents protobuf marshalling errors for types that don't implement protobuf.
type jsonOnlyNegotiatedSerializer struct {
	scheme  *runtime.Scheme
	wrapped runtime.NegotiatedSerializer
	accepts []runtime.SerializerInfo
}

// NewJSONOnlyNegotiatedSerializer creates a NegotiatedSerializer that only accepts JSON.
func NewJSONOnlyNegotiatedSerializer(scheme *runtime.Scheme, wrapped runtime.NegotiatedSerializer) runtime.NegotiatedSerializer {
	// Get all supported media types from the wrapped serializer
	allSerializers := wrapped.SupportedMediaTypes()

	// Filter to only JSON serializers
	jsonSerializers := make([]runtime.SerializerInfo, 0, 2)
	for _, info := range allSerializers {
		mediaType, _, err := mime.ParseMediaType(info.MediaType)
		if err != nil {
			continue
		}
		// Only allow JSON media types
		if mediaType == "application/json" || mediaType == "application/json;stream=watch" {
			jsonSerializers = append(jsonSerializers, info)
		}
	}

	return &jsonOnlyNegotiatedSerializer{
		scheme:  scheme,
		wrapped: wrapped,
		accepts: jsonSerializers,
	}
}

func (s *jsonOnlyNegotiatedSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	return s.accepts
}

func (s *jsonOnlyNegotiatedSerializer) EncoderForVersion(encoder runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return s.wrapped.EncoderForVersion(encoder, gv)
}

func (s *jsonOnlyNegotiatedSerializer) DecoderToVersion(decoder runtime.Decoder, gv runtime.GroupVersioner) runtime.Decoder {
	return s.wrapped.DecoderToVersion(decoder, gv)
}

var _ runtime.NegotiatedSerializer = (*jsonOnlyNegotiatedSerializer)(nil)
