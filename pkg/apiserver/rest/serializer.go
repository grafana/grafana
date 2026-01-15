package rest

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

type noProtobufNegotiatedSerializer struct {
	accepts []func(info runtime.SerializerInfo) bool
	runtime.NegotiatedSerializer
}

func (s noProtobufNegotiatedSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	base := s.NegotiatedSerializer.SupportedMediaTypes()
	var suppported []runtime.SerializerInfo
	for _, info := range base {
		for _, accept := range s.accepts {
			if accept(info) {
				suppported = append(suppported, info)
				break
			}
		}
	}
	return suppported
}

// NoProtobuf is a function that omits the support for protobuf.
func NoProtobuf(info runtime.SerializerInfo) bool {
	return info.MediaType != runtime.ContentTypeProtobuf
}

// NoProtobufNegotiatedSerializer is a runtime.NegotiatedSerializer that omits the support for protobuf.
func NoProtobufNegotiatedSerializer(codecs serializer.CodecFactory, accepts ...func(info runtime.SerializerInfo) bool) runtime.NegotiatedSerializer {
	return noProtobufNegotiatedSerializer{accepts, codecs.WithoutConversion()}
}

// DefaultNoProtobufNegotiatedSerializer is the default serializer that does not use protobuf.
// Our types do not implement protobuf encoding, so we exclude protobuf support to prevent
// namespace deletion failures (see issue https://github.com/kubernetes/kubernetes/issues/86666).
func DefaultNoProtobufNegotiatedSerializer(codecs serializer.CodecFactory) runtime.NegotiatedSerializer {
	return NoProtobufNegotiatedSerializer(codecs, NoProtobuf)
}
