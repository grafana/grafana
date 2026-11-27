package provisioning

import (
	"fmt"
	"reflect"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
)

// v1beta2StorageVersion is the version v1beta2 objects are persisted, admitted and handed to the
// controllers as. Switching storage to v1beta2 later starts here.
var v1beta2StorageVersion = provisioning.SchemeGroupVersion

// v1beta2Kind returns the v1beta2 kind of obj, or false when obj is not a v1beta2 type.
func v1beta2Kind(scheme *runtime.Scheme, obj runtime.Object) (schema.GroupVersionKind, bool) {
	kinds, _, err := scheme.ObjectKinds(obj)
	if err != nil {
		return schema.GroupVersionKind{}, false
	}
	for _, kind := range kinds {
		if kind.GroupVersion() == v1beta2.GroupVersion {
			return kind, true
		}
	}
	return schema.GroupVersionKind{}, false
}

// toStorageVersion converts a v1beta2 object to a new object of the storage version.
func toStorageVersion(scheme *runtime.Scheme, obj runtime.Object) (runtime.Object, error) {
	kind, ok := v1beta2Kind(scheme, obj)
	if !ok {
		return nil, fmt.Errorf("expected a %s object, got %T", v1beta2.GroupVersion, obj)
	}
	storageKind := v1beta2StorageVersion.WithKind(kind.Kind)
	out, err := scheme.New(storageKind)
	if err != nil {
		return nil, err
	}
	if err := scheme.Convert(obj, out, nil); err != nil {
		return nil, err
	}
	out.GetObjectKind().SetGroupVersionKind(storageKind)
	return out, nil
}

// fromStorageVersion replaces the content of the v1beta2 object into with in, a storage version
// object. into is overwritten as a whole, so nothing it held before survives.
func fromStorageVersion(scheme *runtime.Scheme, in runtime.Object, into runtime.Object) error {
	kind, ok := v1beta2Kind(scheme, into)
	if !ok {
		return fmt.Errorf("expected a %s object, got %T", v1beta2.GroupVersion, into)
	}
	out, err := scheme.New(kind)
	if err != nil {
		return err
	}
	if err := scheme.Convert(in, out, nil); err != nil {
		return err
	}
	out.GetObjectKind().SetGroupVersionKind(kind)
	reflect.ValueOf(into).Elem().Set(reflect.ValueOf(out).Elem())
	return nil
}
