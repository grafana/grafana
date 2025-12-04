package collections

import (
	"context"
	"fmt"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apiserver/pkg/admission"
)

var _ builder.APIGroupValidation = (*DatasourceStacksValidator)(nil)

type DatasourceStacksValidator struct{}

func GetDatasourceStacksValidator() builder.APIGroupValidation {
	return &DatasourceStacksValidator{}
}

func (v *DatasourceStacksValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	operation := a.GetOperation()

	if operation == admission.Connect {
		return fmt.Errorf("Connect operation is not allowed (%s %s)", a.GetName(), a.GetKind().GroupVersion().String())
	}

	if operation != admission.Create && operation != admission.Update {
		return nil
	}

	cast, ok := obj.(*collections.DataSourceStack)
	if !ok {
		return fmt.Errorf("object is not of type *collections.DataSourceStack (%s %s)", a.GetName(), a.GetKind().GroupVersion().String())
	}

	// get the keys from the template
	template := cast.Spec.Template

	templateNames := map[string]bool{}
	for _, item := range template {
		// template items cannot be empty
		if item.Group == "" || item.Name == "" {
			return fmt.Errorf("template items cannot be empty (%s %s)", a.GetName(), a.GetKind().GroupVersion().String())
		}
		// template names must be unique
		if _, exists := templateNames[item.Name]; exists {
			return fmt.Errorf("template item names must be unique. name '%s' already exists (%s %s)", item.Name, a.GetName(), a.GetKind().GroupVersion().String())
		}
		templateNames[item.Name] = true
	}

	// for each mode, check that the keys are in the template
	modes := cast.Spec.Modes

	for _, mode := range modes {
		for key := range mode.Definition {
			// if a key is not in the template, return an error
			if _, ok := template[key]; !ok {
				return fmt.Errorf("key '%s' is not in the DataSourceStack template (%s %s)", key, a.GetName(), a.GetKind().GroupVersion().String())
			}
		}
	}

	return nil
}
