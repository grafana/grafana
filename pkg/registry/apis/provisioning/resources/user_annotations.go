package resources

import (
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// userGrafanaAnnotations are annotations under a Grafana-owned domain that hold
// user content, so they are written to the repository like user annotations.
var userGrafanaAnnotations = map[string]struct{}{
	utils.AnnoKeyUseCrossDashboardVariables: {},
}

// IsGrafanaOwnedAnnotation reports whether an annotation key is owned by Grafana
// (or Kubernetes) rather than by the user. Owned annotations are never written to
// a repository file, as Grafana sets them itself. Subdomains of the Grafana
// domains (e.g. alerting.grafana.app) are owned too, while the Kubernetes domains
// are matched exactly so that user-facing ones such as app.kubernetes.io are not.
func IsGrafanaOwnedAnnotation(key string) bool {
	if _, ok := userGrafanaAnnotations[key]; ok {
		return false
	}
	domain, _, ok := strings.Cut(key, "/")
	if !ok {
		return false
	}
	domain = strings.ToLower(domain)
	switch {
	case domain == "grafana.app", strings.HasSuffix(domain, ".grafana.app"),
		domain == "grafana.com", strings.HasSuffix(domain, ".grafana.com"),
		domain == "kubernetes.io", domain == "k8s.io", domain == "kubectl.kubernetes.io":
		return true
	default:
		return false
	}
}

// userAnnotations returns the user-owned annotations, or nil when there are none.
func userAnnotations(annotations map[string]string) map[string]string {
	var kept map[string]string
	for key, value := range annotations {
		if IsGrafanaOwnedAnnotation(key) {
			continue
		}
		if kept == nil {
			kept = make(map[string]string, len(annotations))
		}
		kept[key] = value
	}
	return kept
}
