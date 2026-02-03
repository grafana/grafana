package models

import (
	"fmt"

	"github.com/prometheus/alertmanager/config"
)

const ResourceTypeInhibitionRule = "inhibition-rule"

// InhibitionRule is the domain model for inhibition rules with metadata.
// It embeds the upstream Alertmanager InhibitRule and adds Grafana-specific fields.
type InhibitionRule struct {
	UID                string `json:"-" yaml:"-"`
	config.InhibitRule `json:",inline" yaml:",inline"`
	Version            string         `json:"version,omitempty"`
	Provenance         Provenance     `json:"provenance,omitempty"`
	Origin             ResourceOrigin `json:"origin,omitempty"`
}

// ResourceID returns the UID for provenance tracking.
func (ir InhibitionRule) ResourceID() string {
	return ir.UID
}

// ResourceType returns the resource type for provenance tracking.
func (ir InhibitionRule) ResourceType() string {
	return ResourceTypeInhibitionRule
}

func (ir *InhibitionRule) Validate() error {
	// Matchers are already validated during conversion via labels.NewMatcher()
	// which checks regex compilation and label name validity.
	// We only support modern matchers (not deprecated source_match/target_match),
	// so we just validate presence here.

	if len(ir.SourceMatchers) == 0 {
		return fmt.Errorf("inhibition rule must have at least one source matcher")
	}
	if len(ir.TargetMatchers) == 0 {
		return fmt.Errorf("inhibition rule must have at least one target matcher")
	}

	return nil
}
