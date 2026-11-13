package resources

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	secret "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
)

// secureValuesField is the top-level object field where kinds declare inline
// secure values (common.InlineSecureValues).
const secureValuesField = "secure"

// ErrSecureValuesNotAllowed matches a rejection by checkSecureValues, and is what the export
// write returns for a secret, which no repository is handed. Callers that reserve quota ahead
// of a write use it to tell this pre-write rejection, which creates nothing, from a failure
// that may have written.
var ErrSecureValuesNotAllowed = errors.New("secure values not allowed in this repository type")

// secureValuesRejection tags the rejection for ErrSecureValuesNotAllowed while
// delegating Error to the wrapped validation error, so the message the API
// returns is unchanged.
type secureValuesRejection struct{ error }

func (secureValuesRejection) Is(target error) bool { return target == ErrSecureValuesNotAllowed }

func (e secureValuesRejection) Unwrap() error { return e.error }

// checkSecureValues rejects content that writes to the secret store when the
// repository type does not allow it: a resource carrying inline secure values, and a
// resource of the secrets group, which is the secret itself.
//
// Call this only where a repository is accepting content. Reading a file to
// learn which resource it refers to -- a delete, or the revision a write
// supersedes -- has to keep working even when that file already carries a
// secret, or a repository can never be cleaned up.
func checkSecureValues(parsed *ParsedResource) error {
	if parsed.Repo.Type.AllowsSecureValues() {
		return nil
	}

	if isSecretResource(parsed.GVK.GroupKind()) {
		return secureValuesRejection{NewResourceValidationError(field.Forbidden(
			field.NewPath("kind"),
			fmt.Sprintf("%s resources hold a secret and cannot be provisioned from a %s repository",
				parsed.GVK.Kind, parsed.Repo.Type),
		))}
	}

	keys := secureValueWrites(parsed.Obj.Object)
	if len(keys) == 0 {
		return nil
	}

	return secureValuesRejection{NewResourceValidationError(field.Forbidden(
		field.NewPath(secureValuesField),
		fmt.Sprintf("secure values (%s) cannot be created or removed from a %s repository; only references to existing secure values are allowed",
			strings.Join(keys, ", "), parsed.Repo.Type),
	))}
}

// isSecretResource reports whether a kind is served by the secrets group, whose objects are
// secrets rather than resources that merely reference one.
func isSecretResource(gk schema.GroupKind) bool {
	return gk.Group == secret.APIGroup
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

// keepPlaintextSecureValues copies committed plaintext into updated for the keys the
// update never mentions; a reference it does carry already provisions the value.
func keepPlaintextSecureValues(committed, updated *unstructured.Unstructured) {
	if !sameResourceIdentity(committed, updated) {
		return
	}

	previous, ok := committed.Object[secureValuesField].(map[string]any)
	if !ok {
		return
	}

	current, _ := updated.Object[secureValuesField].(map[string]any)
	for key, value := range previous {
		secureValue, ok := value.(map[string]any)
		if !ok {
			continue
		}
		if create, ok := secureValue["create"].(string); !ok || create == "" {
			continue
		}
		if _, mentioned := current[key]; mentioned {
			continue
		}

		if current == nil {
			current = map[string]any{}
			updated.Object[secureValuesField] = current
		}
		current[key] = runtime.DeepCopyJSON(secureValue)
	}
}

// sameResourceIdentity reports whether both files describe the same resource (any
// version): a replacement is authorized on its own, so it must not inherit the secret.
func sameResourceIdentity(a, b *unstructured.Unstructured) bool {
	agvk, bgvk := a.GroupVersionKind(), b.GroupVersionKind()

	return a.GetName() != "" && a.GetName() == b.GetName() &&
		agvk.Group == bgvk.Group && agvk.Kind == bgvk.Kind
}
