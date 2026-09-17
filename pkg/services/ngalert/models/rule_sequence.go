package models

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

const (
	// RuleSequenceGroupPrefix is the synthetic group name prefix assigned to
	// rules that belong to a rule sequence. The scheduler and sequence builder
	// use this prefix to identify sequence groups and evaluate them sequentially.
	RuleSequenceGroupPrefix = "sequence_for_uid_"

	// RuleSequenceGroupNameLength is the total length of the padded sentinel
	// group name. It intentionally exceeds the 190-character storage
	// validation limit so that a user cannot create a real rule group that
	// matches a sequence sentinel.
	RuleSequenceGroupNameLength = 200
)

// RuleSequenceGroup is a synthetic rule group that represents a sequence of
// rules. The padded sentinel value exceeds the max rule group name length
// (190), making it impossible for a user-created group to collide with it.
type RuleSequenceGroup struct {
	sequenceUID string
}

// NewRuleSequenceGroup constructs a RuleSequenceGroup for the given sequence
// UID. It returns an error if the UID is too long to fit in the padded
// sentinel. The UID itself is assumed to be valid (validated at admission).
func NewRuleSequenceGroup(sequenceUID string) (*RuleSequenceGroup, error) {
	if len(sequenceUID) > RuleSequenceGroupNameLength-len(RuleSequenceGroupPrefix) {
		return nil, fmt.Errorf("sequence UID is too long: %s", sequenceUID)
	}
	return &RuleSequenceGroup{sequenceUID: sequenceUID}, nil
}

// String returns the full padded sentinel group name.
func (ruleGroup *RuleSequenceGroup) String() string {
	sb := strings.Builder{}
	sb.WriteString(RuleSequenceGroupPrefix)
	sb.WriteString(ruleGroup.sequenceUID)
	for sb.Len() < RuleSequenceGroupNameLength {
		sb.WriteRune('*')
	}
	return sb.String()
}

// GetSequenceUID returns the sequence UID embedded in this sentinel.
func (ruleGroup *RuleSequenceGroup) GetSequenceUID() string {
	return ruleGroup.sequenceUID
}

// IsRuleSequenceGroup returns true if the given rule group name is a valid
// sequence sentinel: correct prefix, correct total length, and enough padding
// characters that it could not have passed normal storage validation.
func IsRuleSequenceGroup(ruleGroup string) bool {
	return strings.HasPrefix(ruleGroup, RuleSequenceGroupPrefix) &&
		len(ruleGroup) == RuleSequenceGroupNameLength &&
		strings.Count(ruleGroup, "*") >= (RuleSequenceGroupNameLength-len(RuleSequenceGroupPrefix)-util.MaxUIDLength)
}

// ParseRuleSequenceGroup extracts the sequence UID from a sentinel group name.
func ParseRuleSequenceGroup(ruleGroup string) (*RuleSequenceGroup, error) {
	if !IsRuleSequenceGroup(ruleGroup) {
		return nil, fmt.Errorf("rule group %q is not a sequence group", ruleGroup)
	}
	sequenceUID := strings.TrimRight(strings.TrimPrefix(ruleGroup, RuleSequenceGroupPrefix), "*")
	if err := util.ValidateUID(sequenceUID); err != nil {
		return nil, fmt.Errorf("rule group %q contains invalid sequence UID: %w", ruleGroup, err)
	}
	return &RuleSequenceGroup{sequenceUID: sequenceUID}, nil
}

// SchedulableRuleSequence describes a sequence of rules that should be
// evaluated sequentially. Recording rules run first, followed by alert rules,
// all at the sequence's interval.
type SchedulableRuleSequence struct {
	UID               string
	IntervalSeconds   int64
	RecordingRuleRefs []string
	AlertRuleRefs     []string
}

// EnrichRulesWithSequenceMembership overrides in-memory fields on rules that
// belong to a sequence. For each sequence member it sets:
//   - RuleGroup to a padded sentinel group name that exceeds the storage
//     validation limit (so it cannot collide with user-created groups)
//   - RuleGroupIndex to the rule's position (recording rules first, then alert rules, 1-indexed)
//   - IntervalSeconds to the sequence's interval
//
// Rules not referenced by any sequence are left unchanged. This function does
// not write to the database; mutations are in-memory only.
func EnrichRulesWithSequenceMembership(rules []*AlertRule, sequences []SchedulableRuleSequence) {
	type membership struct {
		sequenceUID     string
		intervalSeconds int64
		index           int
	}
	lookup := make(map[string]membership)
	for _, seq := range sequences {
		idx := 1
		for _, uid := range seq.RecordingRuleRefs {
			lookup[uid] = membership{seq.UID, seq.IntervalSeconds, idx}
			idx++
		}
		for _, uid := range seq.AlertRuleRefs {
			lookup[uid] = membership{seq.UID, seq.IntervalSeconds, idx}
			idx++
		}
	}

	for _, rule := range rules {
		m, ok := lookup[rule.UID]
		if !ok {
			continue
		}
		seqGroup, err := NewRuleSequenceGroup(m.sequenceUID)
		if err != nil {
			// This should not happen in practice: sequence UIDs come from the
			// database and are validated on write. Skip rather than panic.
			continue
		}
		rule.RuleGroup = seqGroup.String()
		rule.RuleGroupIndex = m.index
		rule.IntervalSeconds = m.intervalSeconds
	}
}
