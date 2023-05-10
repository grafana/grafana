package util

import (
	"crypto/sha256"
	"fmt"
	"regexp"
)

var validNamePattern = regexp.MustCompile(`^[a-z][-a-z0-9|-]*`).MatchString

// IsValidCK8sCRDName checks if a name can be used for a kubernetes CRD resource
// * contain at most 63 characters
// * start with a lowercase alpha character
// * contain only lowercase alphanumeric characters or '-'
func IsValidCK8sCRDName(name string) bool {
	return validNamePattern(name) && len(name) < 64
}

// GrafanaUIDToK8sName defines a consistent mapping between Grafana UIDs and k8s compatible names
func GrafanaUIDToK8sName(uid string) string {
	if IsValidCK8sCRDName(uid) {
		return uid // OK, so just use it directly
	}

	h := sha256.New()
	_, _ = h.Write([]byte(uid))
	bs := h.Sum(nil)
	return fmt.Sprintf("g%x", bs[:12])
}
