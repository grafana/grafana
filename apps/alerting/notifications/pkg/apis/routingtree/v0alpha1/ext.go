package v0alpha1

import (
	"github.com/grafana/grafana/apps/alerting/common"
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
