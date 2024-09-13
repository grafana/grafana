package v0alpha1

import "fmt"

const InternalPrefix = "grafana.com/"
const ProvenanceStatusAnnotationKey = InternalPrefix + "provenance"
const ProvenanceStatusNone = "none"

func (o *TimeInterval) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return ProvenanceStatusNone
	}
	return s
}

func (o *TimeInterval) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = ProvenanceStatusNone
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
}

func (o *Receiver) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return ProvenanceStatusNone
	}
	return s
}

func (o *Receiver) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = ProvenanceStatusNone
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
}

func (o *Receiver) SetAccessControl(action string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[AccessControlAnnotation(action)] = "true"
}

// AccessControlAnnotation returns the key for the access control annotation for the given action.
// Ex. grafana.com/access/canDelete.
func AccessControlAnnotation(action string) string {
	return fmt.Sprintf("%s%s/%s", InternalPrefix, "access", action)
}
