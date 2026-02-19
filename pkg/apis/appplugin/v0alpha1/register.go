package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const VERSION = "v0alpha1"

// AddKnownTypes registers the Settings types with the given scheme and group version.
// The group is dynamic (one per app plugin), so it must be provided by the caller.
func AddKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) error {
	scheme.AddKnownTypes(gv,
		&Settings{},
		&SettingsList{},
	)
	metav1.AddToGroupVersion(scheme, gv)
	return nil
}
