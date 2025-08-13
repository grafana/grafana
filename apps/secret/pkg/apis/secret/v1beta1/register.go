//
// THIS FILE IS MANUALLY GENERATED TO OVERCOME LIMITATIONS WITH CUE. FEEL FREE TO EDIT IT.
//

package v1beta1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var SecureValuesResourceInfo = utils.NewResourceInfo(
	APIGroup, APIVersion,
	"securevalues", "securevalue", "SecureValue",
	func() runtime.Object { return &SecureValue{} },
	func() runtime.Object { return &SecureValueList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Description", Type: "string", Format: "string", Description: "Short description that explains the purpose of this SecureValue"},
			{Name: "Keeper", Type: "string", Format: "string", Description: "Storage of the secure value"},
			{Name: "Ref", Type: "string", Format: "string", Description: "If present, the reference to a secret"},
		},
		Reader: func(obj any) ([]any, error) {
			if r, ok := obj.(*SecureValue); ok {
				return []any{r.Name, r.Spec.Description, r.Spec.Keeper, r.Spec.Ref}, nil
			}

			return nil, fmt.Errorf("expected SecureValue but got %T", obj)
		},
	},
)

var KeeperResourceInfo = utils.NewResourceInfo(
	APIGroup, APIVersion,
	"keepers", "keeper", "Keeper",
	func() runtime.Object { return &Keeper{} },
	func() runtime.Object { return &KeeperList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Description", Type: "string", Format: "string", Description: "Short description for the Keeper"},
		},
		Reader: func(obj any) ([]any, error) {
			if r, ok := obj.(*Keeper); ok {
				return []any{r.Name, r.Spec.Description}, nil
			}

			return nil, fmt.Errorf("expected Keeper but got %T", obj)
		},
	},
)

// SchemeGroupVersion is group version used to register these objects.
var SchemeGroupVersion = schema.GroupVersion{Group: APIGroup, Version: APIVersion}

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) error {
	scheme.AddKnownTypes(
		schema.GroupVersion{Group: APIGroup, Version: version},
		&SecureValue{},
		&SecureValueList{},
		&Keeper{},
		&KeeperList{},
	)

	return nil
}
