package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var UserStorageResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"user-storage", "user-storage", "UserStorage",
	func() runtime.Object { return &UserStorage{} },
	func() runtime.Object { return &UserStorageList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Data", Type: "string"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*UserStorage)
			if !ok || m == nil {
				return nil, fmt.Errorf("expected user storage")
			}
			return []any{
				m.Name,
				m.Spec.Data,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = GroupVersion
)

func init() {
	localSchemeBuilder.Register(addKnownTypes)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&UserStorage{},
		&UserStorageList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}
