package models

import (
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"golang.org/x/exp/maps"

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

// SilenceWithMetadata is a helper type for managing a silence with associated metadata.
type SilenceWithMetadata struct {
	*Silence
	Metadata SilenceMetadata
}

// SilenceMetadata contains metadata about a silence. Fields are pointers to allow for metadata to be optionally loaded.
type SilenceMetadata struct {
	RuleMetadata *SilenceRuleMetadata
	Permissions  *SilencePermissionSet
}

// SilenceRuleMetadata contains metadata about the rule associated with a silence.
type SilenceRuleMetadata struct {
	RuleUID   string
	RuleTitle string
	FolderUID string
}

// SilencePermission is a type for representing a silence permission.
type SilencePermission string

const (
	SilencePermissionRead   SilencePermission = "read"
	SilencePermissionCreate SilencePermission = "create"
	SilencePermissionWrite  SilencePermission = "write"
)

// SilencePermissions returns all possible silence permissions.
func SilencePermissions() [3]SilencePermission {
	return [3]SilencePermission{
		SilencePermissionRead,
		SilencePermissionCreate,
		SilencePermissionWrite,
	}
}

// SilencePermissionSet represents a set of permissions for a silence.
type SilencePermissionSet map[SilencePermission]bool

// Clone returns a deep copy of the permission set.
func (p SilencePermissionSet) Clone() SilencePermissionSet {
	return maps.Clone(p)
}

// AllSet returns true if all possible permissions are set.
func (p SilencePermissionSet) AllSet() bool {
	for _, permission := range SilencePermissions() {
		if _, ok := p[permission]; !ok {
			return false
		}
	}
	return true
}

// Has returns true if the given permission is allowed in the set.
func (p SilencePermissionSet) Has(permission SilencePermission) bool {
	return p[permission]
}
