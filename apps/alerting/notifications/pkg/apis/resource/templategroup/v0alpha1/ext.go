package v0alpha1

import (
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/apps/alerting/common"
)

const DefaultTemplateTitle = "Built-in Templates"

func (o *TemplateGroup) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[common.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return common.ProvenanceStatusNone
	}
	return s
}

func (o *TemplateGroup) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = common.ProvenanceStatusNone
	}
	o.Annotations[common.ProvenanceStatusAnnotationKey] = status
}

func SelectableFields(obj *TemplateGroup) fields.Set {
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
