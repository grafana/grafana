package customtheme

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"

	customtheme "github.com/grafana/grafana/pkg/apis/customtheme/v0alpha1"
)

func CustomThemeToSelectableFields(obj *customtheme.CustomTheme) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)

	specificFields := fields.Set{
		"spec.userUid": obj.Spec.UserUID,
	}

	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

func CustomThemeGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	theme, ok := obj.(*customtheme.CustomTheme)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a CustomTheme")
	}
	return labels.Set(theme.Labels), CustomThemeToSelectableFields(theme), nil
}
