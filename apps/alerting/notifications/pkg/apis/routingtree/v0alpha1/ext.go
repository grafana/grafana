package v0alpha1

import (
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

const UserDefinedRoutingTreeName = "user-defined"

func (o *RoutingTree) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return v0alpha1.ProvenanceStatusNone
	}
	return s
}

func (o *RoutingTree) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = v0alpha1.ProvenanceStatusNone
	}
	o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey] = status
}
