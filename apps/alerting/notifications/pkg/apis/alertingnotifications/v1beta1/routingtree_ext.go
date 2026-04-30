package v1beta1

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

func (o *RoutingTree) SetAccessControl(action string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[AccessControlAnnotation(action)] = "true"
}
