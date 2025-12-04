package collections

import (
	"context"
	"fmt"
	"net/http"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/client-go/kubernetes"
)

var _ builder.APIGroupValidation = (*DatasourceStacksValidator)(nil)

type DatasourceStacksValidator struct {
	restConfigProvider apiserver.RestConfigProvider
}

func GetDatasourceStacksValidator(restConfigProvider apiserver.RestConfigProvider) builder.APIGroupValidation {
	return &DatasourceStacksValidator{restConfigProvider: restConfigProvider}
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
		for key, item := range mode.Definition {
			// if a key is not in the template, return an error
			if _, ok := template[key]; !ok {
				return fmt.Errorf("key '%s' is not in the DataSourceStack template (%s %s)", key, a.GetName(), a.GetKind().GroupVersion().String())
			}

			exists, err := v.checkDatasourceExists(ctx, template[key].Group, item.DataSourceRef)
			if err != nil {
				return fmt.Errorf("error fetching: datasource '%s' does not exist (%s %s): %w", item.DataSourceRef, a.GetName(), a.GetKind().GroupVersion().String(), err)
			}
			if !exists {
				return fmt.Errorf("datasource '%s' does not exist (%s %s)", item.DataSourceRef, a.GetName(), a.GetKind().GroupVersion().String())
			}

		}
	}

	return nil
}

func (v *DatasourceStacksValidator) checkDatasourceExists(ctx context.Context, group, name string) (bool, error) {
	cfg, err := v.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return false, err
	}

	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return false, err
	}

	result := client.RESTClient().Get().
		Prefix("apis", group, "v0alpha1").
		Namespace("default").
		Resource("datasources").
		Name(name).
		Do(ctx)

	if err = result.Error(); err != nil {
		return false, err
	}

	var statusCode int

	result = result.StatusCode(&statusCode)
	if statusCode == http.StatusNotFound {
		return false, nil
	}

	return true, nil
}
