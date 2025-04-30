package v0alpha1

import (
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

func (o *TimeInterval) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return v0alpha1.ProvenanceStatusNone
	}
	return s
}

func (o *TimeInterval) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = v0alpha1.ProvenanceStatusNone
	}
	o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey] = status
}

func SelectableFields(obj *TimeInterval) fields.Set {
	if obj == nil {
		return nil
	}
	selectable := Schema().SelectableFields()
	set := make(fields.Set, len(selectable))
	for _, field := range selectable {
		f, err := field.FieldValueFunc(obj)
		if err != nil {
			continue
		}
		set[field.FieldSelector] = f
	}
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), set)
}
