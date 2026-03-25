package dashboard

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

const variableFolderLabelKey = "dashboard.grafana.app/folder"

// VariableToSelectableFields returns fields available for selectors.
func VariableToSelectableFields(obj *dashv2beta1.Variable) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)
	specificFields := fields.Set{
		"spec.spec.name": getVariableName(obj.Spec),
	}
	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

// VariableGetAttrs returns labels and fields of a Variable object.
func VariableGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	variable, ok := obj.(*dashv2beta1.Variable)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a Variable")
	}
	return labels.Set(variable.Labels), VariableToSelectableFields(variable), nil
}
