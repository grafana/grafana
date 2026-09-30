package v1

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ResourceUID string

type ResourceMetadata struct {
	UID        ResourceUID
	Version    string
	Provenance models.Provenance
	// Manager is the richer form of Provenance: it records which tool manages the resource
	// (e.g. Terraform, kubectl) and its identity. Provenance is always the coarse view of Manager
	// (models.ManagerPropertiesToProvenance). It is assigned per revision next to Provenance and,
	// like Provenance, is not part of the resource fingerprint (Version).
	Manager utils.ManagerProperties
}

// SetManager sets the manager of the resource and the provenance derived from it.
func (m *ResourceMetadata) SetManager(manager utils.ManagerProperties) {
	m.Manager = manager
	m.Provenance = models.ManagerPropertiesToProvenance(manager)
}

// SetImported marks the resource as imported from an external (converted Prometheus) Alertmanager
// configuration. Imported resources are not tracked in the provisioning store.
func (m *ResourceMetadata) SetImported() {
	m.SetManager(models.ProvenanceToManagerProperties(models.ProvenanceConvertedPrometheus))
}

// NormalizeManager makes Manager and Provenance consistent. A known Manager is authoritative and
// determines Provenance. Otherwise, Manager is derived from Provenance, so callers that only set
// Provenance (and know nothing about managers) keep working.
func (m *ResourceMetadata) NormalizeManager() {
	if m.Manager.Kind != utils.ManagerKindUnknown {
		m.Provenance = models.ManagerPropertiesToProvenance(m.Manager)
		return
	}
	m.Manager = models.ProvenanceToManagerProperties(m.Provenance)
}

// AssignManager sets the provenance and manager read from the provisioning store. stored is the
// record's ManagerProperties, or the zero value when there is no record. Without a known kind,
// the manager is derived from the provenance.
func (m *ResourceMetadata) AssignManager(provenance models.Provenance, stored utils.ManagerProperties) {
	m.Provenance = provenance
	if stored.Kind != utils.ManagerKindUnknown {
		m.Manager = stored
		return
	}
	m.Manager = models.ProvenanceToManagerProperties(provenance)
}

type Matcher struct {
	Type  MatcherType
	Label string
	Value string
}

func (m Matcher) Validate() error {
	switch m.Type {
	case MatcherEqual, MatcherNotEqual, MatcherEqualRegex, MatcherNotEqualRegex:
	default:
		return fmt.Errorf("unknown matcher type: %s", m.Type)
	}
	if m.Type == MatcherEqualRegex || m.Type == MatcherNotEqualRegex {
		_, err := regexp.Compile("^(?:" + m.Value + ")$")
		if err != nil {
			return fmt.Errorf("invalid regex pattern: %w", err)
		}
	}
	return nil
}

func NewMatcher(t MatcherType, label, value string) Matcher {
	return Matcher{
		Type:  t,
		Label: label,
		Value: value,
	}
}

type MatcherType string

const (
	MatcherEqual         MatcherType = "="
	MatcherNotEqual      MatcherType = "!="
	MatcherEqualRegex    MatcherType = "=~"
	MatcherNotEqualRegex MatcherType = "!~"
)
