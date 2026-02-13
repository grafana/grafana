package models

import (
	"fmt"
	"hash/fnv"
	"slices"

	"go.yaml.in/yaml/v3"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
)

const ResourceTypeInhibitionRule = "inhibition-rule"

// InhibitionRule is the domain model for inhibition rules with metadata.
// It embeds the upstream Alertmanager InhibitRule and adds Grafana-specific fields.
type InhibitionRule struct {
	Name               string `json:"name" yaml:"name"`
	UID                string `json:"uid" yaml:"uid"`
	config.InhibitRule `json:",inline" yaml:",inline"`
	Version            string         `json:"version,omitempty"`
	Provenance         Provenance     `json:"provenance,omitempty"`
	Origin             ResourceOrigin `json:"origin,omitempty"`
}

// NewInhibitionRule creates a models.InhibitionRule
func NewInhibitionRule(name string, rule config.InhibitRule, prov Provenance) *InhibitionRule {
	origin := ResourceOriginGrafana
	if prov == ProvenanceConvertedPrometheus {
		origin = ResourceOriginImported
	}

	ir := &InhibitionRule{
		Name:        name,
		InhibitRule: rule,
		UID:         NameToUid(name),
		Provenance:  prov,
		Origin:      origin,
	}

	ir.Version = ir.Hash()

	return ir
}

func (ir *InhibitionRule) UnmarshalYAML(unmarshal func(interface{}) error) error {
	// First, manually unmarshal our own fields
	var temp struct {
		Name       string         `yaml:"name"`
		UID        string         `yaml:"uid"`
		Provenance Provenance     `yaml:"provenance,omitempty"`
		Origin     ResourceOrigin `yaml:"origin,omitempty"`
		Version    string         `yaml:"version,omitempty"`
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
	ir.UID = temp.UID
	ir.Provenance = temp.Provenance
	ir.Origin = temp.Origin
	ir.Version = temp.Version

	return nil
}

func (ir *InhibitionRule) UnmarshalJSON(b []byte) error {
	return yaml.Unmarshal(b, ir)
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

	if ir.Name == "" {
		return fmt.Errorf("inhibition rule name must not be empty")
	}

	return nil
}

func (ir *InhibitionRule) Hash() string {
	sum := fnv.New64a()
	separator := []byte{255}

	// Helper to write bytes with separator
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(separator)
	}

	// Hash source matchers (sorted)
	sourceMatchers := sortMatchers(ir.SourceMatchers)
	for _, m := range sourceMatchers {
		writeBytes([]byte(m.Type.String()))
		writeBytes([]byte(m.Name))
		writeBytes([]byte(m.Value))
	}

	// Hash target matchers (sorted)
	targetMatchers := sortMatchers(ir.TargetMatchers)
	for _, m := range targetMatchers {
		writeBytes([]byte(m.Type.String()))
		writeBytes([]byte(m.Name))
		writeBytes([]byte(m.Value))
	}

	// Hash equal labels (sorted)
	equal := slices.Clone(ir.Equal)
	slices.Sort(equal)
	for _, e := range equal {
		writeBytes([]byte(e))
	}

	// Return as 16-character hex string (like routes)
	return fmt.Sprintf("%016x", sum.Sum64())
}

// sortMatchers returns a sorted copy of matchers for stable hashing
func sortMatchers(matchers []*labels.Matcher) []*labels.Matcher {
	result := make([]*labels.Matcher, 0, len(matchers))
	for _, m := range matchers {
		if m != nil {
			result = append(result, m)
		}
	}
	slices.SortFunc(result, func(a, b *labels.Matcher) int {
		// Compare by type first
		if a.Type != b.Type {
			return int(a.Type) - int(b.Type)
		}
		// Then by name
		if a.Name < b.Name {
			return -1
		} else if a.Name > b.Name {
			return 1
		}
		// Finally by value
		if a.Value < b.Value {
			return -1
		} else if a.Value > b.Value {
			return 1
		}
		return 0
	})
	return result
}
