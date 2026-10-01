package apistore

import (
	"bytes"
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// Serializer encodes and decodes the JSON resources persisted by unified storage.
// Implementations must be safe for concurrent use and honor the request context
// when performing external calls. Version policies are enforced on the encoded JSON.
type Serializer interface {
	// Encode must retain the resource metadata and return bytes that remain valid after the call.
	Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error)
	// Decode must populate into when non-nil; callers may ignore the returned object.
	Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error)
}

type codecSerializer struct {
	codec       runtime.Codec
	preserveGVK bool
}

func (c *codecSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	obj, _, err := c.codec.Decode(data, nil, into)
	return obj, err
}

func (c *codecSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	// Declared kinds historically bypass version conversion on writes. The codec
	// can choose a different version or group when one Go type has several GVKs.
	if c.preserveGVK {
		return (&jsonSerializer{}).Encode(ctx, obj)
	}
	var buf bytes.Buffer
	if err := c.codec.Encode(obj, &buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type jsonSerializer struct{}

// JSONSerializer preserves the object's GVK without scheme lookup or version conversion.
// Decode allocates an unstructured object when no destination is supplied.
func JSONSerializer() Serializer {
	return &jsonSerializer{}
}

func (c *jsonSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	if into == nil {
		into = &unstructured.Unstructured{}
	}
	err := json.Unmarshal(data, into)
	return into, err
}

func (c *jsonSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(obj); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
