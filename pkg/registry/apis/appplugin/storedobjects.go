package appplugin

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	openapi "k8s.io/kube-openapi/pkg/common"
	openapispec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// storedObjectKind is the parsed form of one stored object declared by a
// plugin's schema artifact.
type storedObjectKind struct {
	Kind       string
	Plural     string
	Singular   string
	Cluster    bool
	Validation []pluginschema.AdmissionOperation
	Mutation   []pluginschema.AdmissionOperation
}

// parseStoredObjects returns the declared stored objects for the builder's
// current api version, or nil when none are declared.
func (b *AppPluginAPIBuilder) parseStoredObjects() ([]storedObjectKind, error) {
	if b.schemas == nil {
		return nil, nil
	}
	ps, ok := b.schemas[b.groupVersion.Version]
	if !ok || ps == nil || ps.StoredObjects == nil || len(ps.StoredObjects.Items) == 0 {
		return nil, nil
	}

	out := make([]storedObjectKind, 0, len(ps.StoredObjects.Items))
	for _, so := range ps.StoredObjects.Items {
		if so.Name == "" {
			return nil, fmt.Errorf("plugin %q has a stored object without a name", b.pluginJSON.ID)
		}
		plural := so.Plural
		if plural == "" {
			plural = strings.ToLower(so.Name) + "s"
		}
		singular := so.Singular
		if singular == "" {
			singular = strings.ToLower(so.Name)
		}
		out = append(out, storedObjectKind{
			Kind:       so.Name,
			Plural:     plural,
			Singular:   singular,
			Cluster:    so.Scope == pluginschema.ScopeCluster,
			Validation: so.Validation,
			Mutation:   so.Mutation,
		})
	}
	return out, nil
}

func (b *AppPluginAPIBuilder) storedObjectResourceInfo(k storedObjectKind) utils.ResourceInfo {
	info := utils.NewResourceInfo(b.groupVersion.Group, b.groupVersion.Version, k.Plural, k.Singular, k.Kind,
		func() runtime.Object { return &storedObject{} },
		func() runtime.Object { return &storedList{} },
		utils.TableColumns{},
	)
	if k.Cluster {
		info = info.WithClusterScope()
	}
	return info
}

// installStoredObjectSchemas registers every declared stored object's kind on
// the runtime scheme. The internal version is registered alongside the
// external one because admission and server-side apply both need a Go type
// behind the internal representation.
func (b *AppPluginAPIBuilder) installStoredObjectSchemas(scheme *runtime.Scheme) error {
	kinds, err := b.parseStoredObjects()
	if err != nil {
		return err
	}
	internalGV := schema.GroupVersion{Group: b.groupVersion.Group, Version: runtime.APIVersionInternal}
	for _, k := range kinds {
		listKind := k.Kind + "List"

		scheme.AddKnownTypeWithName(schema.GroupVersionKind{Group: b.groupVersion.Group, Version: b.groupVersion.Version, Kind: k.Kind}, &storedObject{})
		scheme.AddKnownTypeWithName(schema.GroupVersionKind{Group: b.groupVersion.Group, Version: b.groupVersion.Version, Kind: listKind}, &storedList{})

		scheme.AddKnownTypeWithName(schema.GroupVersionKind{Group: internalGV.Group, Version: internalGV.Version, Kind: k.Kind}, &storedObject{})
		scheme.AddKnownTypeWithName(schema.GroupVersionKind{Group: internalGV.Group, Version: internalGV.Version, Kind: listKind}, &storedList{})
	}
	return nil
}

// installStoredObjectStorage adds an apistore-backed REST store per declared
// stored object into storage. The same map gets assigned to
// apiGroupInfo.VersionedResourcesStorageMap[version] alongside the settings
// resource and its subresources.
func (b *AppPluginAPIBuilder) installStoredObjectStorage(storage map[string]rest.Storage, opts builder.APIGroupOptions) error {
	kinds, err := b.parseStoredObjects()
	if err != nil {
		return err
	}
	for _, k := range kinds {
		ri := b.storedObjectResourceInfo(k)
		store, err := grafanaregistry.NewRegistryStore(opts.Scheme, ri, opts.OptsGetter)
		if err != nil {
			return fmt.Errorf("creating storage for stored object %s: %w", ri.GetName(), err)
		}
		storage[ri.StoragePath()] = store
	}
	return nil
}

// mergeStoredObjectOpenAPIDefinitions adds OpenAPI definitions for the
// stored-object wrappers into defs. The group-version-kind extension on each
// definition is required for server-side apply to resolve a Go type for
// every served kind; without it, apply requests fail.
func (b *AppPluginAPIBuilder) mergeStoredObjectOpenAPIDefinitions(defs map[string]openapi.OpenAPIDefinition) {
	kinds, err := b.parseStoredObjects()
	if err != nil || len(kinds) == 0 {
		return
	}
	objectGVKs := make([]interface{}, 0, len(kinds))
	listGVKs := make([]interface{}, 0, len(kinds))
	for _, k := range kinds {
		objectGVKs = append(objectGVKs, map[string]interface{}{
			"group": b.groupVersion.Group, "version": b.groupVersion.Version, "kind": k.Kind,
		})
		listGVKs = append(listGVKs, map[string]interface{}{
			"group": b.groupVersion.Group, "version": b.groupVersion.Version, "kind": k.Kind + "List",
		})
	}

	defs[goReflectPath(&storedObject{})] = storedObjectDefinition(objectGVKs)
	defs[goReflectPath(&storedList{})] = storedObjectDefinition(listGVKs)
}

func storedObjectDefinition(gvks []interface{}) openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: openapispec.Schema{
			VendorExtensible: openapispec.VendorExtensible{
				Extensions: openapispec.Extensions{
					"x-kubernetes-group-version-kind": gvks,
				},
			},
			SchemaProps: openapispec.SchemaProps{
				Description: "Generic representation of a plugin-schema-declared stored object",
				Type:        []string{"object"},
			},
		},
	}
}

func goReflectPath(obj interface{}) string {
	t := reflect.TypeOf(obj)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.PkgPath() + "." + t.Name()
}

// storedObject and storedList wrap the generic untyped resource types so the
// runtime scheme can disambiguate this package's kinds from any others.
// Without the wrappers, kinds across multiple plugins would share one Go
// type and the scheme could return a cross-plugin kind during request
// normalization.
type storedObject struct {
	resource.UntypedObject
}

// Copy must be overridden (not just DeepCopyObject) so ZeroValue returns this
// package-local type. Otherwise the scheme would register the generic
// untyped type and the per-package distinction above is lost.
func (o *storedObject) Copy() resource.Object {
	cpy := &storedObject{}
	if inner, ok := o.UntypedObject.Copy().(*resource.UntypedObject); ok {
		cpy.UntypedObject = *inner
	}
	return cpy
}

func (o *storedObject) DeepCopyObject() runtime.Object {
	return o.Copy()
}

type storedList struct {
	resource.UntypedList
}

func (l *storedList) Copy() resource.ListObject {
	cpy := &storedList{}
	if inner, ok := l.UntypedList.Copy().(*resource.UntypedList); ok {
		cpy.UntypedList = *inner
	}
	return cpy
}

func (l *storedList) DeepCopyObject() runtime.Object {
	return l.Copy()
}
