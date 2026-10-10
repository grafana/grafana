package definitions

import (
	"go.yaml.in/yaml/v3"
)

type ManagedInhibitionRules map[string]*InhibitionRule

// InhibitionRule is the domain model for inhibition rules with metadata.
// It embeds the upstream Alertmanager InhibitRule and adds Grafana-specific fields.
type InhibitionRule struct {
	Name        string `json:"name" yaml:"name"`
	InhibitRule `json:",inline" yaml:",inline"`
	Provenance  Provenance `json:"provenance,omitempty"`
	// ManagerKind and ManagerIdentity identify the tool that manages the rule, when it is more
	// specific than what Provenance can express. When they are missing, the manager is derived from
	// Provenance.
	ManagerKind     string `json:"managerKind,omitempty" yaml:"managerKind,omitempty"`
	ManagerIdentity string `json:"managerIdentity,omitempty" yaml:"managerIdentity,omitempty"`
}

func (ir *InhibitionRule) UnmarshalYAML(unmarshal func(interface{}) error) error {
	// First, manually unmarshal our own fields
	var temp struct {
		Name            string     `yaml:"name"`
		Provenance      Provenance `yaml:"provenance,omitempty"`
		ManagerKind     string     `yaml:"managerKind,omitempty"`
		ManagerIdentity string     `yaml:"managerIdentity,omitempty"`
	}
	if err := unmarshal(&temp); err != nil {
		return err
	}

	// Now call the embedded type's UnmarshalYAML to get its validation
	if err := ir.InhibitRule.UnmarshalYAML(unmarshal); err != nil {
		return err
	}

	// Set our fields
	ir.Name = temp.Name
	ir.Provenance = temp.Provenance
	ir.ManagerKind = temp.ManagerKind
	ir.ManagerIdentity = temp.ManagerIdentity

	return nil
}

func (ir *InhibitionRule) UnmarshalJSON(b []byte) error {
	return yaml.Unmarshal(b, ir)
}
