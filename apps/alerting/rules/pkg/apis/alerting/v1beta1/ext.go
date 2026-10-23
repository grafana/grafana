package v1beta1

import (
	"fmt"
	"time"

	prom_model "github.com/prometheus/common/model"
)

const (
	InternalPrefix                = "grafana.com/"
	GroupLabelKey                 = InternalPrefix + "group"
	GroupIndexLabelKey            = GroupLabelKey + "-index"
	ProvenanceStatusAnnotationKey = InternalPrefix + "provenance"
	// AccessControlAnnotationPrefix names a requester-specific capability hint
	// annotation, e.g. AccessControlAnnotationPrefix + "canWrite". It is a
	// response-only hint computed per request: never read back from a
	// create/update body, and never persisted.
	AccessControlAnnotationPrefix = InternalPrefix + "access/"
	// Copy of the max title length used in legacy validation path
	AlertRuleMaxTitleLength = 190
	// Annotation key used to store the folder UID on resources
	FolderAnnotationKey = "grafana.app/folder"
	FolderLabelKey      = FolderAnnotationKey
	// Annotation key mirroring the legacy PrometheusStyleRule original definition.
	PrometheusRuleDefinitionAnnotationKey = "alerting.grafana.app/prometheus-rule-definition"
)

// NOTE: This is a copy of the constants from the alertrule package to avoid circular imports.
// Keep in sync with pkg/services/ngalert/models/provisioning.go
const (
	ProvenanceStatusNone                = ""
	ProvenanceStatusAPI                 = "api"
	ProvenanceStatusFile                = "file"
	ProvenanceStatusConvertedPrometheus = "converted_prometheus"
)

var (
	AcceptedProvenanceStatuses = []string{ProvenanceStatusNone, ProvenanceStatusAPI, ProvenanceStatusFile, ProvenanceStatusConvertedPrometheus}
)

// AccessControlAnnotation returns the annotation key for a requester-specific
// access capability, e.g. AccessControlAnnotation("canWrite") ==
// "grafana.com/access/canWrite". Mirrors the convention used by other
// Alerting k8s resources (see receiver_ext.go).
func AccessControlAnnotation(action string) string {
	return AccessControlAnnotationPrefix + action
}

func ToDuration(s string) (time.Duration, error) {
	promDuration, err := prom_model.ParseDuration(s)
	if err != nil {
		return 0, fmt.Errorf("invalid duration format: %w", err)
	}
	return time.Duration(promDuration), nil
}

// Convert the string duration to the longest valid Prometheus duration format (e.g., "60s" -> "1m")
func ClampDuration(s string) (string, error) {
	promDuration, err := prom_model.ParseDuration(s)
	if err != nil {
		return "", fmt.Errorf("invalid duration format: %w", err)
	}
	return promDuration.String(), nil
}
