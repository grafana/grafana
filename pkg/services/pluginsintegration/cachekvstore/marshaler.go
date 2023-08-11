package cachekvstore

import (
	"encoding/json"
	"fmt"
)

// Marshaler can marshal a value to a string before storing it into the key-value store.
type Marshaler interface {
	Marshal() (string, error)
}

// JSONMarshaler is a Marshaler that marshals the value to JSON.
type JSONMarshaler struct {
	value any
}

// NewJSONMarshaler returns a new JSONMarshaler for the provided value.
func NewJSONMarshaler(v any) JSONMarshaler {
	return JSONMarshaler{value: v}
}

// Marshal marshals the value to JSON using json.Marshal, and returns it as a string.
func (m JSONMarshaler) Marshal() (string, error) {
	b, err := json.Marshal(m.value)
	if err != nil {
		return "", fmt.Errorf("json marshal: %w", err)
	}
	return string(b), nil
}

// Marshal marshals the value to a string using the default marshaling.
// The underlying value can be a type implementing Marshaler, fmt.Stringer or a string, []byte.
// It returns an error if the type is not supported.
func Marshal(value any) (string, error) {
	switch value := value.(type) {
	case Marshaler:
		return value.Marshal()
	case fmt.Stringer:
		return value.String(), nil
	case string:
		return value, nil
	case []byte:
		return string(value), nil
	default:
		return "", fmt.Errorf("unsupported value type: %T", value)
	}
}
