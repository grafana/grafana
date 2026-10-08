package v1

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ResourceUID string

type ResourceMetadata struct {
	UID     ResourceUID
	Version string
	// Manager records which tool manages the resource (e.g. Terraform, kubectl) and its identity.
	// It is assigned per revision and is not part of the resource fingerprint (Version).
	Manager utils.ManagerProperties
}

// Provenance is the legacy, coarse view of Manager.
func (m ResourceMetadata) Provenance() models.Provenance {
	return models.ManagerPropertiesToProvenance(m.Manager)
}

// SetImported marks the resource as imported from an external (converted Prometheus) Alertmanager
// configuration. Imported resources are not tracked in the provisioning store.
func (m *ResourceMetadata) SetImported() {
	m.Manager = models.ProvenanceToManagerProperties(models.ProvenanceConvertedPrometheus)
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
