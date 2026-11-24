package resources

import (
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

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
