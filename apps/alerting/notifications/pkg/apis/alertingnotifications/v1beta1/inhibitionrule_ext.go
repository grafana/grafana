package v1beta1

import (
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"
)

func (o *InhibitionRule) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ProvenanceStatusNone
	}
	s, ok := o.Annotations[ProvenanceStatusAnnotationKey]
	if !ok {
		return ProvenanceStatusNone
	}
	return s
}

func InhibitionRuleSelectableFields(obj *InhibitionRule) fields.Set {
	if obj == nil {
		return nil
	}
	selectable := InhibitionRuleSchema().SelectableFields()
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

func (o *InhibitionRule) SetProvenanceStatus(status string) {
	if status == ProvenanceStatusNone {
		return
	}
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[ProvenanceStatusAnnotationKey] = status
}
