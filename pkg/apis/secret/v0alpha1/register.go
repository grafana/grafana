package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP   = "secret.grafana.app"
	VERSION = "v0alpha1"
)

var SecureValuesResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"securevalues", "securevalue", "SecureValue",
	func() runtime.Object { return &SecureValue{} },
	func() runtime.Object { return &SecureValueList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name"},
			{Name: "Manager", Type: "string", Format: "string", Description: "Values managed by remote services"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*SecureValue)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					r.Spec.Manager,
				}, nil
			}
			return nil, fmt.Errorf("expected SecureValue")
		},
	},
)

var KeyManagerResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"keymanagers", "keymanager", "KeyManager",
	func() runtime.Object { return &KeyManager{} },
	func() runtime.Object { return &KeyManagerList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name"},
			{Name: "Provider", Type: "string", Format: "string", Description: "The provider"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*KeyManager)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					r.Spec.Provider,
				}, nil
			}
			return nil, fmt.Errorf("expected KeyManager")
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) {
	scheme.AddKnownTypes(
		schema.GroupVersion{Group: GROUP, Version: version},
		&SecureValue{},
		&SecureValueList{},
		&KeyManager{},
		&KeyManagerList{},
		&SecureValueActivityList{},
	)
}
