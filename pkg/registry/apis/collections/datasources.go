package collections

import (
	"context"
	"fmt"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ grafanarest.Storage = (*datasourceStorage)(nil)

type datasourceStorage struct {
	grafanarest.Storage
}

func (s *datasourceStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	// TODO run our own validation here

	dsStack, ok := obj.(*collections.DataSourceStack)
	if !ok {
		return nil, fmt.Errorf("expected a datasource stack object")
	}

	list := field.ErrorList{}

	// Check that the modes are valid

	// get the keys from the template
	template := dsStack.Spec.Template
	templateKeys := make([]string, 0, len(template))
	for key := range template {
		templateKeys = append(templateKeys, key)
	}

	// for each mode, check that the keys are in the template
	modes := dsStack.Spec.Modes

	// if a key is not in the template, return an error
	for _, mode := range modes {
		for key := range mode.Definition {
			if indexOf(templateKeys, key) == -1 {
				list = append(list, field.Invalid(field.NewPath("spec", "modes", mode.Name, "definition", key), key, fmt.Sprintf("key %s is not in the template", key)))

			}
		}
	}

	if len(list) > 0 {
		return nil, apierrors.NewInvalid(collections.DatasourceStacksResourceInfo.GroupVersionKind().GroupKind(), dsStack.Name, list)
	}

	// TODO find any keys missing from the definition, or is that OK?

	// TODO Check that each data source reference is valid

	return s.Storage.Create(ctx, obj, createValidation, options)
}

func (d *datasourceStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// the objInfo is not obviosuly simply to perform validation on, it feels like we should be performing validation elsewhere.
	return d.Storage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func indexOf(slice []string, item string) int {
	for i, v := range slice {
		if v == item {
			return i
		}
	}
	return -1
}
