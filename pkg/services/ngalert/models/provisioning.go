package models

import (
	"fmt"
	"slices"
)

type Provenance string

const (
	// ProvenanceNone reflects the provenance when no provenance is stored
	// for the requested object in the database.
	ProvenanceNone Provenance = ""
	ProvenanceAPI  Provenance = "api"
	ProvenanceFile Provenance = "file"
	// ProvenanceConvertedPrometheus is used for objects converted from Prometheus definitions.
	ProvenanceConvertedPrometheus Provenance = "converted_prometheus"

	// k8sProvenanceNone is the textual representation of ProvenanceNone used in Kubernetes annotations.
	// https://github.com/grafana/grafana/blob/main/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1/ext.go#L5-L5
	k8sProvenanceNone = "none"
)

var KnownProvenances = []Provenance{ProvenanceNone, ProvenanceAPI, ProvenanceFile, ProvenanceConvertedPrometheus}

// Provisionable represents a resource that can be created through a provisioning mechanism, such as Terraform or config file.
type Provisionable interface {
	ResourceType() string
	ResourceID() string
}

// ProvenanceFromString converts a string to a Provenance type, validating that it is one of the known provenances.
func ProvenanceFromString(s string) (Provenance, error) {
	if s == k8sProvenanceNone {
		return ProvenanceNone, nil
	}

	p := Provenance(s)
	if !slices.Contains(KnownProvenances, p) {
		return Provenance(""), fmt.Errorf("invalid provenance status: %s", s)
	}

	return p, nil
}
