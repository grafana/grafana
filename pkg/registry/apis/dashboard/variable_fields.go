package dashboard

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const variableFolderLabelKey = utils.AnnoKeyFolder

// VariableToSelectableFields returns fields available for selectors.
func VariableToSelectableFields(objectMeta *metav1.ObjectMeta, spec dashv2.VariableSpec) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(objectMeta, true)
	specificFields := fields.Set{
		"spec.spec.name": getVariableName(spec),
	}
	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

func variableFieldLabelConversion(label, value string) (string, string, error) {
	switch label {
	case "metadata.name", "metadata.namespace", "spec.spec.name":
		return label, value, nil
	default:
		return "", "", fmt.Errorf("field label not supported for Variable: %s", label)
	}
}

// VariableGetAttrs returns labels and fields of a Variable object.
func VariableGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	var objectMeta *metav1.ObjectMeta
	switch v := obj.(type) {
	case *dashv2.Variable:
		objectMeta = &v.ObjectMeta
	case *dashv2beta1.Variable:
		objectMeta = &v.ObjectMeta
	default:
		return nil, nil, fmt.Errorf("given object is not a Variable")
	}

	spec, err := variableSpecOf(obj)
	if err != nil {
		return nil, nil, err
	}
	return labels.Set(objectMeta.Labels), VariableToSelectableFields(objectMeta, spec), nil
}
