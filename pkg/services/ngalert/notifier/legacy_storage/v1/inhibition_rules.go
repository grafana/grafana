package v1

import (
	"cmp"
	"fmt"
	"hash/fnv"
	"slices"
	"strings"

	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

type InhibitionRule struct {
	ResourceMetadata

	SourceMatchers []Matcher
	TargetMatchers []Matcher
	Equal          []string
}

// ResourceID returns the UID for provenance tracking.
func (ir InhibitionRule) ResourceID() string {
	return string(ir.UID)
}

const ResourceTypeInhibitionRule = "inhibition-rule"

// ResourceType returns the resource type for provenance tracking.
func (ir InhibitionRule) ResourceType() string {
	return ResourceTypeInhibitionRule
}

func (ir *InhibitionRule) Validate() error {
	// We only support modern matchers (not deprecated source_match/target_match),
	// so we just validate presence here.

	if len(ir.SourceMatchers) == 0 {
		return fmt.Errorf("inhibition rule must have at least one source matcher")
	}
	if len(ir.TargetMatchers) == 0 {
		return fmt.Errorf("inhibition rule must have at least one target matcher")
	}

	uid := string(ir.UID)
	if strings.TrimSpace(uid) == "" {
		return fmt.Errorf("inhibition rule uid must not be empty")
	}

	if strings.Contains(uid, ":") {
		return fmt.Errorf("inhibition rule uid cannot contain invalid character ':'")
	}

	if errs := k8svalidation.IsDNS1123Subdomain(uid); len(errs) > 0 {
		return fmt.Errorf("inhibition rule uid must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}

	// imported inhibition rules have purposefully long names to ensure no conflict with non-imported ones
	if ir.Provenance != models.ProvenanceConvertedPrometheus && len(uid) > ualert.UIDMaxLength {
		return fmt.Errorf("inhibition rule uid is too long (exceeds %d characters)", ualert.UIDMaxLength)
	}

	for _, m := range ir.SourceMatchers {
		if err := m.Validate(); err != nil {
			return fmt.Errorf("invalid source matcher: %w", err)
		}
	}

	for _, m := range ir.TargetMatchers {
		if err := m.Validate(); err != nil {
			return fmt.Errorf("invalid target matcher: %w", err)
		}
	}

	return nil
}

func NewInhibitionRule(
	uid string,
	sourceMatchers []Matcher,
	targetMatchers []Matcher,
	equal []string,
	provenance models.Provenance,
) InhibitionRule {
	ir := InhibitionRule{
		ResourceMetadata: ResourceMetadata{
			UID:        ResourceUID(uid),
			Provenance: provenance,
		},
		SourceMatchers: sourceMatchers,
		TargetMatchers: targetMatchers,
		Equal:          equal,
	}
	ir.Version = InhibitionRuleFingerprint(ir)
	return ir
}

func InhibitionRuleFingerprint(ir InhibitionRule) string {
	sum := fnv.New64a()
	separator := []byte{255}
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(separator)
	}

	sourceMatchers := sortedMatchers(ir.SourceMatchers)
	for _, m := range sourceMatchers {
		writeBytes([]byte(m.Type))
		writeBytes([]byte(m.Label))
		writeBytes([]byte(m.Value))
	}

	targetMatchers := sortedMatchers(ir.TargetMatchers)
	for _, m := range targetMatchers {
		writeBytes([]byte(m.Type))
		writeBytes([]byte(m.Label))
		writeBytes([]byte(m.Value))
	}

	equal := slices.Clone(ir.Equal)
	slices.Sort(equal)
	for _, e := range equal {
		writeBytes([]byte(e))
	}

	return fmt.Sprintf("%016x", sum.Sum64())
}

func sortedMatchers(matchers []Matcher) []Matcher {
	return slices.SortedFunc(slices.Values(matchers), func(a, b Matcher) int {
		return cmp.Or(
			cmp.Compare(a.Type, b.Type),
			cmp.Compare(a.Label, b.Label),
			cmp.Compare(a.Value, b.Value),
		)
	})
}
