package pluginmanifest

import (
	"reflect"

	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
)

// goReflectPath returns "<pkgpath>.<TypeName>" for the concrete type behind a pointer,
// matching the key the kube-openapi builder uses to look up a Go type's definition.
func goReflectPath(obj interface{}) string {
	t := reflect.TypeOf(obj)
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	return t.PkgPath() + "." + t.Name()
}

// manifestObject / manifestList are distinct Go types (per the pluginmanifest package)
// that embed the SDK's generic UntypedObject / UntypedList.
//
// Plugin-manifest kinds have no concrete Go type, so without these wrappers every kind
// across every plugin-manifest app would be backed by the single resource.UntypedObject
// type. Because all app installers register into one shared API server scheme, that one
// type ends up registered under GVKs from MANY groups (each app's kinds plus a per-app
// "none" discovery dummy). When the REST create handler normalizes an object's GVK via
// scheme.ObjectKinds, the non-Unstructured lookup returns that whole multi-group list and
// an arbitrary, cross-app group (e.g. quotas.grafana.app) can be stamped onto the object —
// which unified storage then rejects with "group in key does not match group in the body".
//
// Using a dedicated type for plugin-manifest objects means scheme.ObjectKinds only ever
// returns GVKs registered for THIS package's type. All of those share the plugin's group
// (the manifest app's group across its versions and the "none" dummy), so the persisted
// group always matches the request group and the mismatch cannot occur. Codegen'd apps are
// untouched — they keep their concrete per-kind types.
type manifestObject struct {
	resource.UntypedObject
}

// Copy must be overridden (not just DeepCopyObject) because resource.SimpleSchema.ZeroValue
// calls Copy(); without this override ZeroValue would return a bare UntypedObject and the
// scheme would register the wrong (shared) type, silently losing the fix.
func (o *manifestObject) Copy() resource.Object {
	cpy := &manifestObject{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *manifestObject) DeepCopyObject() runtime.Object {
	return o.Copy()
}

type manifestList struct {
	resource.UntypedList
}

func (l *manifestList) Copy() resource.ListObject {
	cpy := &manifestList{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *manifestList) DeepCopyObject() runtime.Object {
	return l.Copy()
}
