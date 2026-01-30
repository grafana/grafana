package apiregistry

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	sdkres "github.com/grafana/grafana-app-sdk/resource"
)

// These helper functions are to be used in InstallSchema() in apis/*/register.go files in order for already existing kinds to use field selectors.

// AddSelectableFieldLabelConversions registers field selector conversions for kinds that
// expose selectable fields via the app SDK.
func AddSelectableFieldLabelConversions(scheme *runtime.Scheme, gv schema.GroupVersion, kinds ...sdkres.Kind) error {
	for _, kind := range kinds {
		gvk := gv.WithKind(kind.Kind())
		err := scheme.AddFieldLabelConversionFunc(
			gvk,
			func(label, value string) (string, string, error) {
				if label == "metadata.name" || label == "metadata.namespace" {
					return label, value, nil
				}
				fields := kind.SelectableFields()
				for _, field := range fields {
					if field.FieldSelector == label {
						return label, value, nil
					}
				}
				return "", "", fmt.Errorf("field label not supported for %s: %s", gvk, label)
			},
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func BuildGetAttrsFn(k sdkres.Kind) func(obj runtime.Object) (labels.Set, fields.Set, error) {
	return func(obj runtime.Object) (labels.Set, fields.Set, error) {
		if robj, ok := obj.(sdkres.Object); !ok {
			return nil, nil, fmt.Errorf("not a resource.Object")
		} else {
			fieldsSet := fields.Set{}

			for _, f := range k.SelectableFields() {
				v, err := f.FieldValueFunc(robj)
				if err != nil {
					return nil, nil, err
				}
				fieldsSet[f.FieldSelector] = v
			}
			return robj.GetLabels(), fieldsSet, nil
		}
	}
}
