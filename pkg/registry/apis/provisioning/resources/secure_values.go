package resources

import (
	"fmt"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

// secureValuesField is the top-level object field where kinds declare inline
// secure values (common.InlineSecureValues).
const secureValuesField = "secure"

// checkSecureValues rejects content that writes to the secret store when the
// repository type does not allow it.
//
// Call this only where a repository is accepting content. Reading a file to
// learn which resource it refers to -- a delete, or the revision a write
// supersedes -- has to keep working even when that file already carries a
// secret, or a repository can never be cleaned up.
func checkSecureValues(parsed *ParsedResource) error {
	if parsed.Repo.Type.AllowsSecureValues() {
		return nil
	}

	keys := secureValueWrites(parsed.Obj.Object)
	if len(keys) == 0 {
		return nil
	}

	return NewResourceValidationError(field.Forbidden(
		field.NewPath(secureValuesField),
		fmt.Sprintf("secure values (%s) cannot be created or removed from a %s repository; only references to existing secure values are allowed",
			strings.Join(keys, ", "), parsed.Repo.Type),
	))
}

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
