package resources

import "slices"

// secureValuesField is the top-level object field where kinds declare inline
// secure values (common.InlineSecureValues).
const secureValuesField = "secure"

// plaintextSecureValueKeys returns, sorted, the secure values in obj that carry
// a plaintext payload. A key holding only a reference or a removal is not a
// secret, so it is not reported.
func plaintextSecureValueKeys(obj map[string]any) []string {
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
		if create, ok := sv["create"].(string); ok && create != "" {
			keys = append(keys, key)
		}
	}
	slices.Sort(keys)

	return keys
}
