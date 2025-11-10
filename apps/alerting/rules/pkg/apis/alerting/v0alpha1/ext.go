package v0alpha1

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
	// Copy of the max title length used in legacy validation path
	AlertRuleMaxTitleLength = 190
	// Annotation key used to store the folder UID on resources
	FolderAnnotationKey = "grafana.app/folder"
	FolderLabelKey      = FolderAnnotationKey
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
