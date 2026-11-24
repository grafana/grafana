package resources

import (
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// AnnoKeyUseCrossDashboardVariables holds the dashboard's selection of global and folder variables.
const AnnoKeyUseCrossDashboardVariables = "grafana.app/useCrossDashboardVariables"

// Annotations under these domains, or their subdomains, are set by Grafana.
const (
	grafanaAppDomain = "grafana.app"
	grafanaComDomain = "grafana.com"
)

// OmitAnnotationFromFile reports whether Git Sync strips the annotation on write.
func OmitAnnotationFromFile(key string) bool {
	switch key {
	case AnnoKeyUseCrossDashboardVariables:
		return false
	case utils.AnnoKeyKubectlLastAppliedConfig:
		// The previous manifest can contain plaintext values that storage has since redacted.
		return true
	}
	domain, _, ok := strings.Cut(key, "/")
	if !ok {
		return false
	}
	domain = strings.ToLower(domain)
	return domain == grafanaAppDomain || strings.HasSuffix(domain, "."+grafanaAppDomain) ||
		domain == grafanaComDomain || strings.HasSuffix(domain, "."+grafanaComDomain)
}

// dropNonStringAnnotations removes the annotations whose values are not strings,
// such as an unquoted YAML boolean, and returns their keys sorted. A single such
// value makes the whole map unreadable, so Grafana would otherwise replace every
// annotation of the file with its own.
func dropNonStringAnnotations(obj map[string]any) []string {
	value, _, _ := unstructured.NestedFieldNoCopy(obj, "metadata", "annotations")
	annotations, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	var dropped []string
	for key, v := range annotations {
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
