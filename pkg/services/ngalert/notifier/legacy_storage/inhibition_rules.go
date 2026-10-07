package legacy_storage

import (
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func (rev *ConfigRevision) HasInhibitionRule(uid v1.ResourceUID) bool {
	if len(rev.Config.InhibitionRules) == 0 {
		return false
	}
	_, ok := rev.Config.InhibitionRules[uid]
	return ok
}

func (rev *ConfigRevision) SetInhibitionRule(rule v1.InhibitionRule) v1.InhibitionRule {
	if rev.Config.InhibitionRules == nil {
		rev.Config.InhibitionRules = make(map[v1.ResourceUID]v1.InhibitionRule)
	}
	// Ensure Version is set.
	rule.Version = v1.InhibitionRuleFingerprint(rule)
	rev.Config.InhibitionRules[rule.UID] = rule
	return rule
}

func (rev *ConfigRevision) DeleteInhibitionRule(uid v1.ResourceUID) {
	delete(rev.Config.InhibitionRules, uid)
}
