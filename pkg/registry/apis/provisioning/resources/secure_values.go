package resources

import "slices"

// secureValuesField is the top-level object field where kinds declare inline
// secure values (common.InlineSecureValues).
const secureValuesField = "secure"

// secureValueWrites returns, sorted, the secure values in obj that write to the
// secret store: a plaintext payload to create, or a removal. A key holding only
// a reference reads an existing value, so it is not reported.
func secureValueWrites(obj map[string]any) []string {
	secure, ok := obj[secureValuesField].(map[string]any)
	if !ok {
		return nil
	}

	var keys []string
	for key, value := range secure {
		sv, ok := value.(map[string]any)
		if !ok {
			continue
		}
		create, _ := sv["create"].(string)
		remove, _ := sv["remove"].(bool)
		if create != "" || remove {
			keys = append(keys, key)
		}
	}
	slices.Sort(keys)

	return keys
}
