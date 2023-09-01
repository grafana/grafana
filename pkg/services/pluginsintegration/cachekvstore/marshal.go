package cachekvstore

import (
	"encoding/json"
	"fmt"
)

// marshal marshals the provided value to a string to store it in the kv store.
// The provided value can be of a type implementing fmt.Stringer, a string or []byte.
// If the value is none of those, it is marshaled to JSON.
func marshal(value any) (string, error) {
	switch value := value.(type) {
	case fmt.Stringer:
		return value.String(), nil
	case string:
		return value, nil
	case []byte:
		return string(value), nil
	default:
		b, err := json.Marshal(value)
		if err != nil {
			return "", fmt.Errorf("json marshal: %w", err)
		}
		return string(b), nil
	}
}
