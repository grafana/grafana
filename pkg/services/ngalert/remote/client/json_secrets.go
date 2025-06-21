package client

import (
	"unsafe"

	jsoniter "github.com/json-iterator/go"
	"github.com/modern-go/reflect2"
	amcfg "github.com/prometheus/alertmanager/config"
	commoncfg "github.com/prometheus/common/config"
)

// secretEncoder handles both Secret values and *Secret pointer for
// both Alertmanager Secret and prometheus/common Secret
type secretEncoder struct {
	isPtr bool
}

func (encoder *secretEncoder) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	if encoder.isPtr {
		p := *(**string)(ptr)
		if p == nil {
			stream.WriteNil()
			return
		}
		stream.WriteString(*p)
	} else {
		v := *(*string)(ptr)
		stream.WriteString(v)
	}
}

func (encoder *secretEncoder) IsEmpty(ptr unsafe.Pointer) bool {
	if encoder.isPtr {
		p := *(**string)(ptr)
		if p == nil {
			return true
		}
		return len(*p) == 0
	} else {
		return len(*(*string)(ptr)) == 0
	}
}

// secretURLEncoder handles both config.SecretURL values and *config.SecretURL pointer
type secretURLEncoder struct {
	isPtr bool
}

func (encoder *secretURLEncoder) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	if encoder.isPtr {
		p := *(**amcfg.SecretURL)(ptr)
		if p == nil {
			stream.WriteNil()
			return
		}
		encoder.encodeSecretURL(*p, stream)
	} else {
		v := *(*amcfg.SecretURL)(ptr)
		encoder.encodeSecretURL(v, stream)
	}
}

func (encoder *secretURLEncoder) IsEmpty(ptr unsafe.Pointer) bool {
	if encoder.isPtr {
		p := *(**amcfg.SecretURL)(ptr)
		if p == nil {
			return true
		}
		return encoder.isSecretURLEmpty(*p)
	} else {
		v := *(*amcfg.SecretURL)(ptr)
		return encoder.isSecretURLEmpty(v)
	}
}

// encodeSecretURL contains the common logic for encoding SecretURL values
func (encoder *secretURLEncoder) encodeSecretURL(v amcfg.SecretURL, stream *jsoniter.Stream) {
	// SecretURL is a type alias for URL, so we can cast it to URL to access the URL field
	url := amcfg.URL(v)
	if url.URL != nil {
		stream.WriteString(url.String())
	} else {
		stream.WriteNil()
	}
}

func (encoder *secretURLEncoder) isSecretURLEmpty(v amcfg.SecretURL) bool {
	url := amcfg.URL(v)
	return url.URL == nil || url.String() == ""
}

func newPlainAPI() jsoniter.API {
	cfg := jsoniter.Config{
		EscapeHTML:             true,
		SortMapKeys:            true,
		ValidateJsonRawMessage: true,
	}
	api := cfg.Froze()

	extension := jsoniter.EncoderExtension{}

	extension[reflect2.TypeOfPtr((*amcfg.Secret)(nil)).Elem()] = &secretEncoder{isPtr: false}
	extension[reflect2.TypeOfPtr((*amcfg.Secret)(nil))] = &secretEncoder{isPtr: true}
	extension[reflect2.TypeOfPtr((*commoncfg.Secret)(nil)).Elem()] = &secretEncoder{isPtr: false}
	extension[reflect2.TypeOfPtr((*commoncfg.Secret)(nil))] = &secretEncoder{isPtr: true}

	extension[reflect2.TypeOfPtr((*amcfg.SecretURL)(nil)).Elem()] = &secretURLEncoder{isPtr: false}
	extension[reflect2.TypeOfPtr((*amcfg.SecretURL)(nil))] = &secretURLEncoder{isPtr: true}

	api.RegisterExtension(extension)

	return api
}

var (
	plainJSON = newPlainAPI()
)

// MarshalWithSecrets marshals the given value to JSON with secrets in plain text.
// This should be used when sending configuration to remote alertmanager where
// secrets need to be preserved.
func MarshalWithSecrets(v any) ([]byte, error) {
	return plainJSON.Marshal(v)
}
