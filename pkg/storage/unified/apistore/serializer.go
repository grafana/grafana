package apistore

import (
	"bytes"
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// Similar to runtime.Serializer except this keeps context, and MUST be JSON resources
type Serializer interface {
	Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error)
	Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error)
}

type codecSerializer struct {
	codec runtime.Codec
}

// Decode implements [Serializer].
func (c *codecSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	obj, _, err := c.codec.Decode(data, nil, into)
	return obj, err
}

// Encode implements [Serializer].
func (c *codecSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	var buf bytes.Buffer
	if err := c.codec.Encode(obj, &buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type jsonSerializer struct{}

func JSONSerializer() Serializer {
	return &jsonSerializer{}
}

// Decode implements [Serializer].
func (c *jsonSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	if into == nil {
		into = &unstructured.Unstructured{Object: map[string]interface{}{}}
	}
	err := json.Unmarshal(data, into)
	return into, err
}

// Encode implements [Serializer].
func (c *jsonSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(obj); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
