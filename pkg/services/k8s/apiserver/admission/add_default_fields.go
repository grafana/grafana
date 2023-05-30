package admission

import (
	"context"
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

// NOTE: enable the below assertions for convenient interface additions for a plugin when the plugin
// needs an external clientset and informer factory

// var _ = genericadmissioninitializer.WantsExternalKubeClientSet(&addDefaultFields{})
// var _ = genericadmissioninitializer.WantsExternalKubeInformerFactory(&addDefaultFields{})

// Admit makes an admission decision based on the request attributes.
func (addDefaultFields) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	if a.GetOperation() == admission.Delete {
		return nil
	}

	obj := a.GetObject()

	// NOTE: tried using dashboard.K8sResource here, but that doesn't implement runtime.Object
	// gvk is available as one of the attributes for branching off the logic per kind
	// a.GetOldObject() is also available for detecting changed fields and disallowing operation if disallowed fields
	// were modified

	// Interesting behavior: yet to be explained: if you try removing this managed field, it enters a loop
	// which re-triggers this function, eventually leading to a request timeout on the client side

	// Ideally, we would just disallow such removal of a managed field and return an error
	target, ok := obj.(*unstructured.Unstructured)
	if ok {
		spec, ok := target.Object["spec"].(map[string]interface{})
		if ok {
			_, set := spec["default_fields_key_1"].(string)
			if !set {
				spec["default_fields_key_1"] = "default_fields_value_1"
			}
		}
	}

	return nil
}

// NewAddDefaultFields creates an always deny admission handler
func NewAddDefaultFields() admission.Interface {
	return addDefaultFields{
		Handler: admission.NewHandler(admission.Create, admission.Update, admission.Delete),
	}
}
