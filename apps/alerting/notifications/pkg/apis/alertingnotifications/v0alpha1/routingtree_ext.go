package v0alpha1

const UserDefinedRoutingTreeName = "user-defined"

func (o *RoutingTree) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func (o *RoutingTree) SetProvenanceStatus(status string) {
	if status == ProvenanceStatusNone {
		return
	}
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
}
