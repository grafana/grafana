package models

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

const (
	// RuleChainGroupPrefix is the synthetic group name prefix assigned to rules
	// that belong to a rule chain. The scheduler and sequence builder use this
	// prefix to identify chain groups and evaluate them sequentially.
	RuleChainGroupPrefix = "chain_for_uid_"

	// RuleChainGroupNameLength is the total length of the padded sentinel
	// group name. It intentionally exceeds the 190-character storage
	// validation limit so that a user cannot create a real rule group that
	// matches a chain sentinel.
	RuleChainGroupNameLength = 200
)

// RuleChainGroup is a synthetic rule group that represents a chain of rules.
// The padded sentinel value exceeds the max rule group name length (190),
// making it impossible for a user-created group to collide with it.
type RuleChainGroup struct {
	chainUID string
}

// NewRuleChainGroup constructs a RuleChainGroup for the given chain UID.
// It returns an error if the UID is too long to fit in the padded sentinel.
// The UID itself is assumed to be valid (validated at admission).
func NewRuleChainGroup(chainUID string) (*RuleChainGroup, error) {
	if len(chainUID) > RuleChainGroupNameLength-len(RuleChainGroupPrefix) {
		return nil, fmt.Errorf("chain UID is too long: %s", chainUID)
	}
	return &RuleChainGroup{chainUID: chainUID}, nil
}

// String returns the full padded sentinel group name.
func (ruleGroup *RuleChainGroup) String() string {
	sb := strings.Builder{}
	sb.WriteString(RuleChainGroupPrefix)
	sb.WriteString(ruleGroup.chainUID)
	for sb.Len() < RuleChainGroupNameLength {
		sb.WriteRune('*')
	}
	return sb.String()
}

// GetChainUID returns the chain UID embedded in this sentinel.
func (ruleGroup *RuleChainGroup) GetChainUID() string {
	return ruleGroup.chainUID
}

// IsRuleChainGroup returns true if the given rule group name is a valid
// chain sentinel: correct prefix, correct total length, and enough padding
// characters that it could not have passed normal storage validation.
func IsRuleChainGroup(ruleGroup string) bool {
	return strings.HasPrefix(ruleGroup, RuleChainGroupPrefix) &&
		len(ruleGroup) == RuleChainGroupNameLength &&
		strings.Count(ruleGroup, "*") >= (RuleChainGroupNameLength-len(RuleChainGroupPrefix)-util.MaxUIDLength)
}

// ParseRuleChainGroup extracts the chain UID from a sentinel group name.
func ParseRuleChainGroup(ruleGroup string) (*RuleChainGroup, error) {
	if !IsRuleChainGroup(ruleGroup) {
		return nil, fmt.Errorf("rule group %q is not a chain group", ruleGroup)
	}
	chainUID := strings.TrimRight(strings.TrimPrefix(ruleGroup, RuleChainGroupPrefix), "*")
	if err := util.ValidateUID(chainUID); err != nil {
		return nil, fmt.Errorf("rule group %q contains invalid chain UID: %w", ruleGroup, err)
	}
	return &RuleChainGroup{chainUID: chainUID}, nil
}

// SchedulableRuleChain describes a chain of rules that should be evaluated
// sequentially. Recording rules run first, followed by alert rules, all at
// the chain's interval.
type SchedulableRuleChain struct {
	UID               string
	IntervalSeconds   int64
	RecordingRuleRefs []string
	AlertRuleRefs     []string
}

// EnrichRulesWithChainMembership overrides in-memory fields on rules that
// belong to a chain. For each chain member it sets:
//   - RuleGroup to a padded sentinel group name that exceeds the storage
//     validation limit (so it cannot collide with user-created groups)
//   - RuleGroupIndex to the rule's position (recording rules first, then alert rules, 1-indexed)
//   - IntervalSeconds to the chain's interval
//
// Rules not referenced by any chain are left unchanged. This function does
// not write to the database; mutations are in-memory only.
func EnrichRulesWithChainMembership(rules []*AlertRule, chains []SchedulableRuleChain) {
	type membership struct {
		chainUID        string
		intervalSeconds int64
		index           int
	}
	lookup := make(map[string]membership)
	for _, chain := range chains {
		idx := 1
		for _, uid := range chain.RecordingRuleRefs {
			lookup[uid] = membership{chain.UID, chain.IntervalSeconds, idx}
			idx++
		}
		for _, uid := range chain.AlertRuleRefs {
			lookup[uid] = membership{chain.UID, chain.IntervalSeconds, idx}
			idx++
		}
	}

	for _, rule := range rules {
		m, ok := lookup[rule.UID]
		if !ok {
			continue
		}
		chainGroup, err := NewRuleChainGroup(m.chainUID)
		if err != nil {
			// This should not happen in practice: chain UIDs come from the
			// database and are validated on write. Skip rather than panic.
			continue
		}
		rule.RuleGroup = chainGroup.String()
		rule.RuleGroupIndex = m.index
		rule.IntervalSeconds = m.intervalSeconds
	}
}
