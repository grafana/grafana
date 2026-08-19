package unstructured

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
)

type Decoder interface {
	Decode(ctx context.Context, data []byte, apiVersion string) (runtime.Object, error)
}

type Converter interface {
	Convert(ctx context.Context, input map[string]any, targetVersion string) (map[string]any, error)
}

func NewSimpleDecoder() Decoder {
	return &simpleDecoder{}
}

type simpleDecoder struct{}

func (d simpleDecoder) Decode(ctx context.Context, data []byte, apiVersion string) (runtime.Object, error) {
	u := &Unstructured{}
	err := u.UnmarshalJSON(data)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func NewCodecDecoder(codec runtime.Codec, newFunc func() runtime.Object) Decoder {
	return &codecDecoder{codec, newFunc}
}

type codecDecoder struct {
	codec   runtime.Codec
	newFunc func() runtime.Object
}

func (d codecDecoder) Decode(ctx context.Context, data []byte, apiVersion string) (runtime.Object, error) {
	obj, _, err := d.codec.Decode(data, nil, d.newFunc())
	return obj, err
}

type convertingDecoder struct {
}

func (d convertingDecoder) Decode(ctx context.Context, data []byte, apiVersion string) (runtime.Object, error) {
	return nil, nil
}

// func ConvertingDecoder(ctx context.Context, data []byte, _ string) (runtime.Object, error) {
// 	u := &Unstructured{}
// 	err := u.UnmarshalJSON(data)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return u, nil
// }

// var (
// 	_ runtime.Decoder = (*JSONDecoder)(nil)
// )

// // Decode implements [runtime.Decoder].
// func (c *JSONDecoder) Decode(data []byte, _ *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
// 	if into == nil {
// 		into = &Unstructured{}
// 	}
// 	u, ok := into.(*Unstructured)
// 	if !ok {
// 		return nil, nil, fmt.Errorf("this decoder only supports decoding into Unstructured objects")
// 	}

// 	targetAPIVersion := u.GetAPIVersion()

// 	gv, err := schema.ParseGroupVersion(targetAPIVersion)
// 	if err != nil {
// 		return nil, nil, fmt.Errorf("invalid target %w", err)
// 	}

// 	if err = u.UnmarshalJSON(data); err != nil {
// 		return nil, nil, err
// 	}

// 	if targetAPIVersion != "" && targetAPIVersion != u.GetAPIVersion() {
// 		if c.Converter == nil {
// 			return nil, nil, fmt.Errorf("unable to convert to target version")
// 		}
// 		gv, err := schema.ParseGroupVersion(targetAPIVersion)
// 		if err != nil {
// 			return nil, nil, err
// 		}

// 		if err = c.Converter(u.Object, gv.Version); err != nil {
// 			return nil, nil, err
// 		}
// 	}

// 	gvk := gv.WithKind(u.GetKind())
// 	return u, &gvk, nil
// }
