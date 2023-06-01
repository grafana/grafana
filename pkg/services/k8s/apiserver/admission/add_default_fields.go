package admission

import (
	"context"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"k8s.io/apiserver/pkg/admission"
)

const PluginNameAddDefaultFields = "AddDefaultFields"

// Register registers a plugin
func RegisterAddDefaultFields(plugins *admission.Plugins) {
	plugins.Register(PluginNameAddDefaultFields, func(config io.Reader) (admission.Interface, error) {
		return NewAddDefaultFields(), nil
	})
}

type addDefaultFields struct {
	*admission.Handler
}

var _ admission.MutationInterface = addDefaultFields{}

const (
	AddDefaultFieldsKey   = "default_fields_key_1"
	AddDefaultFieldsValue = "default_fields_value_1"
)

// NOTE: enable the below assertions for convenient interface additions for a plugin when the plugin
// needs an external clientset and informer factory

// var _ = genericadmissioninitializer.WantsExternalKubeClientSet(&addDefaultFields{})
// var _ = genericadmissioninitializer.WantsExternalKubeInformerFactory(&addDefaultFields{})

// Admit makes an admission decision based on the request attributes.
func (addDefaultFields) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()

	if true {
		return nil
	}

	// NOTE: tried using dashboard.K8sResource here, but that doesn't implement runtime.Object
	// gvk is available as one of the attributes for branching off the logic per kind

	switch a.GetOperation() {
	case admission.Create:
		target, ok := obj.(*unstructured.Unstructured)
		if ok {
			spec, ok := target.Object["spec"].(map[string]interface{})
			if ok {
				_, set := spec[AddDefaultFieldsKey].(string)
				if !set {
					spec[AddDefaultFieldsKey] = AddDefaultFieldsValue
				}
			}
		}
	case admission.Update:
		// Quick and dirty code with some type assertions that skip error checking
		// in order to demonstrate how to protect a managed field when it already exists in
		// an old object and is being attempted to be removed
		oldObject := a.GetOldObject()

		from, ok := oldObject.(*unstructured.Unstructured)
		if !ok {
			return nil
		}
		fromSpec, ok := from.Object["spec"].(map[string]interface{})
		if !ok {
			return nil
		}
		_, ok = fromSpec[AddDefaultFieldsKey].(string)
		if !ok {
			return nil
		}

		to, ok := obj.(*unstructured.Unstructured)
		if !ok {
			return nil
		}
		toSpec, ok := to.Object["spec"].(map[string]interface{})
		if !ok {
			return admission.NewForbidden(a, fmt.Errorf("error removing managed field from %s", a.GetResource().Resource))
		}
		_, ok = toSpec[AddDefaultFieldsKey]
		if !ok {
			toSpec[AddDefaultFieldsKey] = AddDefaultFieldsValue
		}
	case admission.Delete:
		return nil
	}

	return nil
}

// NewAddDefaultFields creates an always deny admission handler
func NewAddDefaultFields() admission.Interface {
	return addDefaultFields{
		Handler: admission.NewHandler(admission.Create, admission.Update, admission.Delete),
	}
}
