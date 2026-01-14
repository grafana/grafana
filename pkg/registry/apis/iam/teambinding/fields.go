package teambinding

import (
	"errors"

	genv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
)

// GetTeamBindingSelectableFields returns a field set that can be used for field selectors.
func GetTeamBindingSelectableFields(obj *iamv0alpha1.TeamBinding) fields.Set {
	objectMetaFields := generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)

	// Using the generated schema to get selectable fields dynamically
	schema := genv0alpha1.TeamBindingSchema()
	specificFields := fields.Set{}

	for _, selectableField := range schema.SelectableFields() {
		val, err := selectableField.FieldValueFunc(obj)
		if err != nil {
			val = ""
		}
		specificFields[selectableField.FieldSelector] = val
	}

	return generic.MergeFieldsSets(objectMetaFields, specificFields)
}

// GetAttrs returns labels and fields of a TeamBinding object.
// This is used by the storage layer for filtering.
func GetAttrs(o runtime.Object) (labels.Set, fields.Set, error) {
	tb, ok := o.(*iamv0alpha1.TeamBinding)
	if !ok {
		return nil, nil, errors.New("provided object must be of type *TeamBinding")
	}

	return labels.Set(tb.Labels), GetTeamBindingSelectableFields(tb), nil
}
