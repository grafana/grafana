package models

import (
	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/notify"
)

// Silence is the model-layer representation of an alertmanager silence. Currently just a wrapper around the
// alerting notify.Silence.
type Silence notify.GettableSilence

// GetRuleUID returns the rule UID of the silence if the silence is associated with a rule, otherwise nil.
// Currently, this works by looking for a matcher with the RuleUIDLabel name and returning its value.
func (s Silence) GetRuleUID() *string {
	return getRuleUIDLabelValue(s.Silence)
}

// getRuleUIDLabelValue returns the value of the RuleUIDLabel matcher in the given silence, if it exists.
func getRuleUIDLabelValue(silence notify.Silence) *string {
	for _, m := range silence.Matchers {
		if m.Name != nil && *m.Name == alertingModels.RuleUIDLabel {
			return m.Value
		}
	}
	return nil
}
