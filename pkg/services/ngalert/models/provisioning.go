package models

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
)

var KnownProvenances = []Provenance{ProvenanceNone, ProvenanceAPI, ProvenanceFile, ProvenanceConvertedPrometheus}

// Provisionable represents a resource that can be created through a provisioning mechanism, such as Terraform or config file.
type Provisionable interface {
	ResourceType() string
	ResourceID() string
}

// ProvenanceFromString converts a string to a Provenance type, validating that it is one of the known provenances.
func ProvenanceFromString(s string) (Provenance, error) {
	p := Provenance(s)
	if !slices.Contains(KnownProvenances, p) {
		return "", fmt.Errorf("invalid provenance status: %s", s)
	}
	return p, nil
}

// ProvenanceToManagerProperties converts a legacy Provenance value to ManagerProperties.
// This is used as a fallback for rows that predate the manager_kind/manager_identity columns.
func ProvenanceToManagerProperties(p Provenance) utils.ManagerProperties {
	switch p {
	case ProvenanceFile:
		return utils.ManagerProperties{Kind: utils.ManagerKindClassicFP} //nolint:staticcheck
	case ProvenanceAPI:
		return utils.ManagerProperties{Kind: utils.ManagerKindClassicAPI} //nolint:staticcheck
	case ProvenanceConvertedPrometheus:
		return utils.ManagerProperties{Kind: utils.ManagerKindClassicConvertedPrometheus} //nolint:staticcheck
	default:
		return utils.ManagerProperties{}
	}
}

// ManagerPropertiesToProvenance derives the legacy Provenance value from ManagerProperties.
// This keeps the provenance column populated for backwards compatibility with readers
// that do not yet understand manager_kind/manager_identity.
func ManagerPropertiesToProvenance(m utils.ManagerProperties) Provenance {
	switch m.Kind {
	case utils.ManagerKindClassicAPI: //nolint:staticcheck
		return ProvenanceAPI
	case utils.ManagerKindClassicFP: //nolint:staticcheck
		return ProvenanceFile
	case utils.ManagerKindClassicConvertedPrometheus: //nolint:staticcheck
		return ProvenanceConvertedPrometheus
	case utils.ManagerKindTerraform, utils.ManagerKindKubectl:
		return ProvenanceAPI
	case utils.ManagerKindRepo:
		// Git-synced content originates from files, closest legacy equivalent.
		return ProvenanceFile
	default:
		return ProvenanceNone
	}
}
