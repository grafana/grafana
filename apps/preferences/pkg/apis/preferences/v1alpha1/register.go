package v1alpha1

import (
	"fmt"
	time "time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var PreferencesResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"preferences", "preferences", "Preferences",
	func() runtime.Object { return &Preferences{} },
	func() runtime.Object { return &PreferencesList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			p, ok := obj.(*Preferences)
			if ok && p != nil {
				return []any{
					p.Name,
					p.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected preferences")
		},
	},
)

var StarsResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"stars", "stars", "Stars",
	func() runtime.Object { return &Stars{} },
	func() runtime.Object { return &StarsList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			p, ok := obj.(*Stars)
			if ok && p != nil {
				return []any{
					p.Name,
					p.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected stars")
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
	localSchemeBuilder.Register(addKnownTypes, addDefaultingFuncs)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&Preferences{},
		&PreferencesList{},
		&Stars{},
		&StarsList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return nil // return RegisterDefaults(scheme)
}
