package v0alpha1

import (
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/apps/alerting/common"
)

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
	set := fields.Set{
		"metadata.provenance": obj.GetProvenanceStatus(),
	}
	for _, field := range schemaTemplateGroup.SelectableFields() {
		f, err := field.FieldValueFunc(obj)
		if err != nil {
			continue
		}
		set[field.FieldSelector] = f
	}
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), set)
}
