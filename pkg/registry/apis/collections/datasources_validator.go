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
	if a.GetKind().Kind != collections.DatasourceStacksResourceInfo.GroupVersionKind().Kind {
		return nil
	}

	obj := a.GetObject()
	if obj == nil {
		return fmt.Errorf("object is nil (%s %s)", a.GetName(), a.GetKind().GroupVersion().String())
	}

	operation := a.GetOperation()

	if operation != admission.Create && operation != admission.Update {
		return nil
	}

	cast, ok := obj.(*collections.DataSourceStack)
	if !ok {
		return fmt.Errorf("object is not of type *collections.DataSourceStack (%s %s)", a.GetName(), a.GetKind().GroupVersion().String())
	}

	// get the keys from the template
	template := cast.Spec.Template
	templateKeys := map[string]bool{}

	// keys must be unique
	for key := range template {
		if _, ok := templateKeys[key]; ok {
			return fmt.Errorf("template keys must be unique. key '%s' already exists (%s %s)", key, a.GetName(), a.GetKind().GroupVersion().String())
		}
		templateKeys[key] = true
	}

	// template names must be unique
	templateNames := map[string]bool{}
	for name := range template {
		if _, ok := templateNames[name]; ok {
			return fmt.Errorf("template names must be unique. name '%s' already exists (%s %s)", name, a.GetName(), a.GetKind().GroupVersion().String())
		}
		templateNames[name] = true
	}

	// for each mode, check that the keys are in the template
	modes := cast.Spec.Modes

	// if a key is not in the template, return an error
	for _, mode := range modes {
		for key := range mode.Definition {
			if _, ok := templateKeys[key]; !ok {
				return fmt.Errorf("key %s is not in the DataSourceStack template. The template keys are %v (%s %s)", key, templateKeys, a.GetName(), a.GetKind().GroupVersion().String())
			}
		}
	}

	return nil
}
