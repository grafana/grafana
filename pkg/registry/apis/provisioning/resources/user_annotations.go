package resources

import (
	"maps"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/validation/field"

	alertingv1beta1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// grafanaOwnedAnnotationDomains are the key prefixes whose annotations are set
// by Grafana or Kubernetes rather than by users. Subdomains of the Grafana
// domains (e.g. alerting.grafana.app) are owned too. The Kubernetes domains are
// matched exactly so that user-facing ones such as app.kubernetes.io stay
// user-owned.
var (
	grafanaOwnedAnnotationDomains = []string{"grafana.app", "grafana.com"}
	exactOwnedAnnotationDomains   = []string{"kubernetes.io", "k8s.io", "kubectl.kubernetes.io"}
)

// userGrafanaAnnotations are annotations under a Grafana-owned domain that hold
// user content, so they round-trip through the repository like user annotations.
var userGrafanaAnnotations = map[string]struct{}{
	utils.AnnoKeyUseCrossDashboardVariables: {},
	// The rule's author opts in to setting rule group labels; admission rejects
	// grouped rules without it.
	alertingv1beta1.AllowGroupWritesAnnotationKey: {},
}

// IsGrafanaOwnedAnnotation reports whether an annotation key is owned by Grafana
// (or Kubernetes) rather than by the user. Owned annotations are never written to
// a repository file and are ignored when a file contains them: Grafana derives
// them itself, and honouring them from a file would let the file claim a
// manager, folder, source or permission grant.
func IsGrafanaOwnedAnnotation(key string) bool {
	if _, ok := userGrafanaAnnotations[key]; ok {
		return false
	}
	domain, _, ok := strings.Cut(key, "/")
	if !ok || domain == "" {
		return false
	}
	domain = strings.ToLower(domain)
	for _, owned := range grafanaOwnedAnnotationDomains {
		if domain == owned || strings.HasSuffix(domain, "."+owned) {
			return true
		}
	}
	for _, owned := range exactOwnedAnnotationDomains {
		if domain == owned {
			return true
		}
	}
	return false
}

// rawAnnotations returns the metadata.annotations map of obj as stored, without
// copying. It works on the raw map because unstructured.GetAnnotations returns
// nil as soon as one value is not a string, which would make every annotation
// look absent.
func rawAnnotations(obj map[string]any) (map[string]any, bool) {
	value, found, err := unstructured.NestedFieldNoCopy(obj, "metadata", "annotations")
	if err != nil || !found {
		return nil, false
	}
	annotations, ok := value.(map[string]any)
	return annotations, ok
}

// stripGrafanaOwnedAnnotations removes every Grafana-owned annotation from obj in
// place, whatever its value type, and drops the annotations field when nothing
// is left. User annotations are left untouched.
func stripGrafanaOwnedAnnotations(obj map[string]any) {
	annotations, ok := rawAnnotations(obj)
	if !ok {
		return
	}
	for key := range annotations {
		if IsGrafanaOwnedAnnotation(key) {
			delete(annotations, key)
		}
	}
	if len(annotations) == 0 {
		unstructured.RemoveNestedField(obj, "metadata", "annotations")
	}
}

// validateUserAnnotations rejects annotations that are not a map of strings.
// Kubernetes requires string values, and a single non-string value makes the
// whole map unreadable through unstructured.GetAnnotations, so the stamping that
// follows in Parse would silently drop every other annotation of the file.
func validateUserAnnotations(obj map[string]any) error {
	value, found, err := unstructured.NestedFieldNoCopy(obj, "metadata", "annotations")
	if err != nil || !found || value == nil {
		return nil
	}
	path := field.NewPath("metadata", "annotations")
	annotations, ok := value.(map[string]any)
	if !ok {
		return field.Invalid(path, value, "must be a map of strings")
	}
	for _, key := range slices.Sorted(maps.Keys(annotations)) {
		if _, ok := annotations[key].(string); !ok {
			return field.Invalid(path.Key(key), annotations[key], "annotation values must be strings")
		}
	}
	return nil
}
