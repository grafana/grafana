package unstructured

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Decode interface that maintains context
type Decoder interface {
	Decode(ctx context.Context, data []byte, obj runtime.Object) (runtime.Object, error)
}

type Converter interface {
	Convert(ctx context.Context, input map[string]any, targetVersion string) (map[string]any, error)
}

// Runtime Decoder uses the standard runtime codec to decode (and maybe convert) input
func NewRuntimeDecoder(decoder runtime.Decoder) Decoder {
	return &runtimeDecoder{decoder}
}

type runtimeDecoder struct {
	decoder runtime.Decoder
}

func (d runtimeDecoder) Decode(ctx context.Context, data []byte, obj runtime.Object) (runtime.Object, error) {
	obj, _, err := d.decoder.Decode(data, nil, obj)
	return obj, err
}

func NewConvertingDecoder(converter Converter) Decoder {
	return &convertingDecoder{converter}
}

type convertingDecoder struct {
	converter Converter
}

func (d convertingDecoder) Decode(ctx context.Context, data []byte, obj runtime.Object) (runtime.Object, error) {
	u, ok := obj.(*Unstructured)
	if !ok {
		return nil, fmt.Errorf("The converting decoder must be unstructured")
	}

	target := u.GetAPIVersion()
	err := u.UnmarshalJSON(data)
	if err != nil {
		return nil, err
	}

	// When the APIVersion does not match, execute the conversion
	if u.GetAPIVersion() != target && d.converter != nil {
		gv, err := schema.ParseGroupVersion(target)
		if err != nil {
			return nil, err
		}
		u.Object, err = d.converter.Convert(ctx, u.Object, gv.Version)
	}
	return u, err
}
