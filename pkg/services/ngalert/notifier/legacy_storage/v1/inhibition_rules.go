package v1

import (
	"fmt"
	"hash/fnv"
	"slices"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
)

type ManagedInhibitionRules map[string]*InhibitionRule

type InhibitionRule struct {
	Name string
	config.InhibitRule
	Provenance Provenance
}

// ResourceID returns the UID for provenance tracking.
func (ir InhibitionRule) ResourceID() string {
	return ir.Name
}

const ResourceTypeInhibitionRule = "inhibition-rule"

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

func (ir *InhibitionRule) Fingerprint() string {
	sum := fnv.New64a()
	separator := []byte{255}
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(separator)
	}

	sourceMatchers := sortMatchers(ir.SourceMatchers)
	for _, m := range sourceMatchers {
		writeBytes([]byte(m.Type.String()))
		writeBytes([]byte(m.Name))
		writeBytes([]byte(m.Value))
	}

	targetMatchers := sortMatchers(ir.TargetMatchers)
	for _, m := range targetMatchers {
		writeBytes([]byte(m.Type.String()))
		writeBytes([]byte(m.Name))
		writeBytes([]byte(m.Value))
	}

	equal := slices.Clone(ir.Equal)
	slices.Sort(equal)
	for _, e := range equal {
		writeBytes([]byte(e))
	}

	return fmt.Sprintf("%016x", sum.Sum64())
}

func sortMatchers(matchers []*labels.Matcher) []*labels.Matcher {
	result := make([]*labels.Matcher, 0, len(matchers))
	for _, m := range matchers {
		if m != nil {
			result = append(result, m)
		}
	}
	slices.SortFunc(result, func(a, b *labels.Matcher) int {
		if a.Type != b.Type {
			return int(a.Type) - int(b.Type)
		}
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		if a.Value < b.Value {
			return -1
		}
		if a.Value > b.Value {
			return 1
		}
		return 0
	})
	return result
}
