package v0alpha1

import (
	"github.com/grafana/grafana/apps/alerting/common"
)

// Re-define some enum values with confusing names
// TODO figure out how we can control name of enum
const (
	MatcherTypeNotEqual      MatcherType = "!="
	MatcherTypeEqualRegex    MatcherType = "=~"
	MatcherTypeNotEqualRegex MatcherType = "!~"
)

const UserDefinedRoutingTreeName = "user-defined"

func (o *RoutingTree) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[common.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return common.ProvenanceStatusNone
	}
	return s
}

func (o *RoutingTree) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = common.ProvenanceStatusNone
	}
	o.Annotations[common.ProvenanceStatusAnnotationKey] = status
}
