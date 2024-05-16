package models

import (
	amv2 "github.com/prometheus/alertmanager/api/v2/models"

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
		if m != nil && isRuleUIDMatcher(*m) {
			return m.Value
		}
	}
	return nil
}

func isRuleUIDMatcher(m amv2.Matcher) bool {
	return isEqualMatcher(m) && m.Name != nil && *m.Name == alertingModels.RuleUIDLabel
}

func isEqualMatcher(m amv2.Matcher) bool {
	// If IsEqual is nil, it is considered to be true.
	return (m.IsEqual == nil || *m.IsEqual) && (m.IsRegex == nil || !*m.IsRegex)
}

type SilenceWithMetadata struct {
	*Silence
	Metadata *SilenceMetadata
}

type SilenceMetadata struct {
	RuleUID     string
	RuleTitle   string
	FolderUID   string
	Permissions map[SilencePermission]struct{}
}

type SilencePermission string

const (
	SilencePermissionRead   SilencePermission = "read"
	SilencePermissionCreate SilencePermission = "create"
	SilencePermissionWrite  SilencePermission = "write"
)
