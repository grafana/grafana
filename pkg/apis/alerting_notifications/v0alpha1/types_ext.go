package v0alpha1

const InternalPrefix = "grafana.com/"
const ProvenanceStatusAnnotationKey = InternalPrefix + "provenance"
const ProvenanceStatusNone = "none"

func (o *RoutingTree) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return ProvenanceStatusNone
	}
	return s
}

func (o *RoutingTree) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = ProvenanceStatusNone
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
}
