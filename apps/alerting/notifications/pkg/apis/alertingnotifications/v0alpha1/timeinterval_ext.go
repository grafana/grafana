package v0alpha1

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"
)

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

func (o *TimeInterval) SetCanUse(canUse bool) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[CanUseAnnotationKey] = fmt.Sprintf("%v", canUse)
}

func (o *TimeInterval) SetInUse(routesCnt int, rules []string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 2)
	}
	o.Annotations[InUseAnnotation("routes")] = fmt.Sprintf("%d", routesCnt)
	o.Annotations[InUseAnnotation("rules")] = fmt.Sprintf("%d", len(rules))
}

func TimeIntervalSelectableFields(obj *TimeInterval) fields.Set {
	if obj == nil {
		return nil
	}
	selectable := TimeIntervalSchema().SelectableFields()
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
