package resources

import (
	"errors"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ErrInvalidAnnotations marks a resource written without the annotations whose
// values are not strings.
var ErrInvalidAnnotations = errors.New("annotations with non-string values")

// InvalidAnnotationsError lists the annotations dropped from a file because
// their values are not strings. The resource itself is still written.
type InvalidAnnotationsError struct {
	Keys []string
}

func (e *InvalidAnnotationsError) Error() string {
	return "Git Sync ignores annotations whose values are not strings: " + strings.Join(e.Keys, ", ")
}

func (e *InvalidAnnotationsError) Unwrap() error {
	return ErrInvalidAnnotations
}

// invalidAnnotationsWarning returns the warning for a resource written from parsed, if any.
func invalidAnnotationsWarning(parsed *ParsedResource) error {
	if len(parsed.InvalidAnnotations) == 0 {
		return nil
	}
	return &InvalidAnnotationsError{Keys: parsed.InvalidAnnotations}
}

// AnnoKeyUseCrossDashboardVariables holds the dashboard's selection of global and folder variables.
const AnnoKeyUseCrossDashboardVariables = "grafana.app/useCrossDashboardVariables"

func ignoreGrafanaAppAnnotation(key string) bool {
	return key != AnnoKeyUseCrossDashboardVariables && strings.Contains(strings.ToLower(key), "grafana.app")
}

// OmitAnnotationFromFile reports whether Git Sync strips the annotation on write.
func OmitAnnotationFromFile(key string) bool {
	// The previous manifest can contain plaintext values that storage has since redacted.
	if key == utils.AnnoKeyKubectlLastAppliedConfig || ignoreGrafanaAppAnnotation(key) {
		return true
	}
	domain, _, ok := strings.Cut(strings.ToLower(key), "/")
	return ok && (domain == "grafana.com" || strings.HasSuffix(domain, ".grafana.com"))
}

// HasRemovedAnnotations reports whether updated lost an annotation of original
// that Git Sync does not keep in the file.
func HasRemovedAnnotations(path string, original, updated *unstructured.Unstructured) bool {
	if IsFolderMetadataFile(path) {
		// updated is the parsed manifest, whose stamping rebuilds a map holding a
		// non-string value. Typed maps are empty for such a file, so it reports nothing.
		updatedKeys := updated.GetAnnotations()
		for k := range original.GetAnnotations() {
			if _, exists := updatedKeys[k]; !exists {
				return true
			}
		}
		return false
	}
	// User annotations can be deleted intentionally in the PR. Report only keys Git Sync strips.
	originalKeys, _, _ := unstructured.NestedMap(original.Object, "metadata", "annotations")
	updatedKeys, _, _ := unstructured.NestedMap(updated.Object, "metadata", "annotations")
	for k := range originalKeys {
		if _, exists := updatedKeys[k]; !exists && OmitAnnotationFromFile(k) {
			return true
		}
	}
	return false
}

// filterFileAnnotations removes ignored keys before Grafana stamps its own metadata.
// Work on the raw map because a non-string value makes GetAnnotations lose every key.
// Only invalid values on otherwise accepted keys are reported to PR previews.
func filterFileAnnotations(obj map[string]any) []string {
	value, _, _ := unstructured.NestedFieldNoCopy(obj, "metadata", "annotations")
	annotations, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	var dropped []string
	for key, v := range annotations {
		if ignoreGrafanaAppAnnotation(key) {
			delete(annotations, key)
			continue
		}
		switch v.(type) {
		case string, nil: // nulls are read as empty strings
			continue
		}
		delete(annotations, key)
		dropped = append(dropped, key)
	}
	slices.Sort(dropped)
	return dropped
}
