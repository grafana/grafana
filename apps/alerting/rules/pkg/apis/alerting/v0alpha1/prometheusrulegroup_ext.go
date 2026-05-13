package v0alpha1

import (
	"fmt"
	"slices"
)

func (o *PrometheusRuleGroup) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func (o *PrometheusRuleGroup) SetProvenanceStatus(status string) error {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if !slices.Contains(AcceptedProvenanceStatuses, status) {
		return fmt.Errorf("invalid provenance status: %s", status)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
	return nil
}
