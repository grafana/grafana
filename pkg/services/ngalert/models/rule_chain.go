package models

import "strings"

// RuleChainGroupPrefix is the synthetic group name prefix assigned to rules
// that belong to a rule chain. The scheduler and sequence builder use this
// prefix to identify chain groups and evaluate them sequentially.
const RuleChainGroupPrefix = "__chain__"

// IsRuleChainGroup returns true if the given rule group name represents a
// rule chain group (i.e., starts with RuleChainGroupPrefix).
func IsRuleChainGroup(ruleGroup string) bool {
	return strings.HasPrefix(ruleGroup, RuleChainGroupPrefix)
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
//   - RuleGroup to a synthetic "__chain__<chainUID>" group name
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
		rule.RuleGroup = RuleChainGroupPrefix + m.chainUID
		rule.RuleGroupIndex = m.index
		rule.IntervalSeconds = m.intervalSeconds
	}
}
