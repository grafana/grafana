package dashboard

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

const globalVariableFolderLabelKey = "dashboard.grafana.app/folder"

// GlobalVariableToSelectableFields returns fields available for selectors.
func GlobalVariableToSelectableFields(obj *dashv2beta1.GlobalVariable) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)
	specificFields := fields.Set{
		"spec.spec.name": getGlobalVariableName(obj.Spec),
	}
	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

// GlobalVariableGetAttrs returns labels and fields of a GlobalVariable object.
func GlobalVariableGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	globalVariable, ok := obj.(*dashv2beta1.GlobalVariable)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a GlobalVariable")
	}
	return labels.Set(globalVariable.Labels), GlobalVariableToSelectableFields(globalVariable), nil
}
