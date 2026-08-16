package appplugin

import (
	"fmt"
	"maps"
	"net/http"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	openapiutil "k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	kcommon "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/openapi"
)

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		base := apppluginV0.GetOpenAPIDefinitions(ref)
		if b.manifest != nil {
			// NOTE: this is called for each apiserver in the setup, so we may want to cache it
			maps.Copy(base, loadOpenAPIDefinition(ref, b.manifest))

			// Manifest kinds are served as unstructured objects. Routes the
			// post-processor does not rewrite (list samples, request bodies)
			// resolve to the reflected unstructured names, which must have a
			// definition or the spec build fails hard.
			//
			// The server-side-apply type converter indexes models by the
			// x-kubernetes-group-version-kind extension, and it only sees the
			// definitions reachable from each storage's sample object -- for
			// manifest kinds that is always this unstructured definition, so
			// every served kind GVK must be stamped here or apply fails with
			// "no corresponding type for <gvk>".
			base[openapiutil.GetCanonicalTypeName(unstructured.Unstructured{})] = b.unstructuredOpenAPIDefinition("")
			base[openapiutil.GetCanonicalTypeName(unstructured.UnstructuredList{})] = b.unstructuredOpenAPIDefinition("List")
		}
		return base
	}
}

// kindOpenAPIName is both the OpenAPI definition key and the final component
// name for a manifest kind (the definition namer passes names through
// unchanged, so it must not contain a slash).
func kindOpenAPIName(gvk schema.GroupVersionKind) string {
	return gvk.Group + "." + gvk.Version + "." + gvk.Kind
}

// unstructuredOpenAPIDefinition builds the generic object definition served
// for unstructured.Unstructured(List), carrying an x-kubernetes-group-version-kind
// entry for every served manifest kind so the server-side-apply type converter
// can resolve those GVKs. kindSuffix is "" for single objects, "List" for lists.
func (b *AppPluginAPIBuilder) unstructuredOpenAPIDefinition(kindSuffix string) common.OpenAPIDefinition {
	s := spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
	gvks := []interface{}{}
	for _, version := range b.manifest.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			gvks = append(gvks, map[string]interface{}{
				"group":   b.manifest.Group,
				"version": version.Name,
				"kind":    kind.Kind + kindSuffix,
			})
		}
	}
	if len(gvks) > 0 {
		s.AddExtension("x-kubernetes-group-version-kind", gvks)
	}
	return common.OpenAPIDefinition{Schema: s}
}

// loadOpenAPIDefinition loads the schemas for all kinds
func loadOpenAPIDefinition(ref common.ReferenceCallback, manifest *app.ManifestData) map[string]common.OpenAPIDefinition {
	defs := map[string]common.OpenAPIDefinition{}
	if manifest == nil {
		return defs
	}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}

		prefix := manifest.Group + "." + version.Name
		for _, kind := range version.Kinds {
			if kind.Schema == nil {
				continue // legal: kinds without a schema get no documentation
			}
			gvk := schema.GroupVersionKind{
				Group:   manifest.Group,
				Version: version.Name,
				Kind:    kind.Kind,
			}
			k, err := kind.Schema.AsKubeOpenAPI(gvk, ref, prefix)
			if err != nil {
				logging.DefaultLogger.Error("invalid manifest kind schema; the kind will be missing from the OpenAPI spec",
					"gvk", gvk.String(), "error", err)
				continue
			}
			maps.Copy(defs, k)
		}
	}
	return defs
}

func (b *AppPluginAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// This is called once per group version, but the target version is not
	// passed in -- recover it from the spec's Info.Title stamp.
	version := b.specVersion(oas)

	var schema *pluginschema.PluginSchema
	if b.schemas != nil {
		schema = b.schemas[version]
		if schema.IsZero() {
			// The loader currently only extracts the v0alpha1 settings schema;
			// the settings kind is identical in every served version, so reuse
			// it rather than degrading to the generic default.
			schema = b.schemas[apppluginV0.VERSION]
		}
	}

	// The plugin description
	oas.Info.Description = b.pluginJSON.Info.Description

	// Add plugin information
	info := map[string]any{
		"id": b.pluginJSON.ID,
	}
	if b.pluginJSON.Info.Version != "" {
		info["version"] = b.pluginJSON.Info.Version
	}
	if b.pluginJSON.Info.Build.Time > 0 {
		info["build"] = b.pluginJSON.Info.Build.Time
	}
	oas.Info.AddExtension("x-grafana-plugin", info)

	// The root api URL
	root := fmt.Sprintf("/apis/%s/%s/", b.pluginJSON.ID, version)

	b.postProcessManifestKinds(oas, root, version)

	// Hide the resource+proxy routes -- explicit ones will be added if defined below
	for _, v := range []string{"resources", "proxy"} {
		prefix := root + "namespaces/{namespace}/app/{name}/" + v
		r := oas.Paths.Paths[prefix]
		if r != nil && r.Get != nil {
			r.Get.Description = "Get resources in the " + v + " plugin. NOTE, additional routes may exist, but are not exposed via OpenAPI"
			r.Delete = nil
			r.Head = nil
			r.Patch = nil
			r.Post = nil
			r.Put = nil
			r.Options = nil
		}
		delete(oas.Paths.Paths, prefix+"/{path}")
	}

	// Set explicit apiVersion and kind on the datasource
	ps, ok := oas.Components.Schemas[apppluginV0.Settings{}.OpenAPIModelName()]
	if !ok {
		return nil, fmt.Errorf("missing settings type")
	}
	ps.Properties["apiVersion"] = *spec.StringProperty().WithEnum(fmt.Sprintf("%s/%s", b.pluginJSON.ID, version))
	ps.Properties["kind"] = *spec.StringProperty().WithEnum("Settings")

	// Always transform results
	switch {
	case schema.IsZero():
		schema = defaultSchema()
	case schema.SettingsSchema.IsZero():
		schema.SettingsSchema = defaultSchema().SettingsSchema
	}

	return openapi.AugmentOpenAPI(oas, openapi.PluginOptions{
		Schema:   schema,
		Resource: ps,
		SpecName: "SettingsSpec",
		Path:     root + "namespaces/{namespace}/app",
		IsApp:    true,
	})
}

// specVersion returns the version of the group-version spec being processed.
// The builder framework stamps every per-version spec with
// Info.Title = "<group>/<version>" before post-processing runs, and for app
// plugins the group is the plugin id.
func (b *AppPluginAPIBuilder) specVersion(oas *spec3.OpenAPI) string {
	if oas.Info != nil {
		if version, ok := strings.CutPrefix(oas.Info.Title, b.pluginJSON.ID+"/"); ok && version != "" {
			return version
		}
	}
	return apppluginV0.VERSION
}

// postProcessManifestKinds documents manifest-defined kinds in the spec. The
// endpoint installer documents every route from scheme-created zero-value
// unstructured objects, which have no per-kind identity, so the spec builder
// emits generic object schemas and never includes the manifest definitions
// (they are unreachable from any route sample). Inject this version's
// definitions as components and point the kind routes' request and response
// bodies at them. Only the given version is processed: each group version
// gets its own self-contained spec.
func (b *AppPluginAPIBuilder) postProcessManifestKinds(oas *spec3.OpenAPI, root string, version string) {
	if b.manifest == nil || oas.Components == nil || oas.Components.Schemas == nil {
		return
	}

	// Without this, every ref written below dangles and clients see empty models.
	defs := loadOpenAPIDefinition(func(name string) spec.Ref {
		return spec.MustCreateRef("#/components/schemas/" + name)
	}, b.manifest)
	prefix := b.manifest.Group + "." + version + "."
	for name, def := range defs {
		if strings.HasPrefix(name, prefix) {
			s := def.Schema
			oas.Components.Schemas[name] = &s
		}
	}

	gvk := schema.GroupVersionKind{Group: b.manifest.Group}
	for _, v := range b.manifest.Versions {
		if v.Name != version || !v.Served {
			continue
		}
		gvk.Version = v.Name
		for _, kind := range v.Kinds {
			if kind.Schema == nil {
				continue // no schema, nothing to point the routes at
			}
			gvk.Kind = kind.Kind
			name := kindOpenAPIName(gvk)
			ref := spec.MustCreateRef("#/components/schemas/" + name)
			base := root + "namespaces/{namespace}/" + strings.ToLower(kind.Plural)
			if kind.Scope == "Cluster" {
				base = root + strings.ToLower(kind.Plural)
			}

			// Update the request+response bodies to point to a real kind (not unstructured)
			for _, path := range []string{base, base + "/{name}", base + "/{name}/status"} {
				if p := oas.Paths.Paths[path]; p != nil {
					for _, op := range []*spec3.Operation{p.Get, p.Put, p.Post} {
						setOperationRequestResponseBodies(op, ref)
					}
					// PATCH bodies are patch documents; only the response is the kind
					setOperationResponseBodies(p.Patch, ref)
				}
			}

			listName := name + "List"
			oas.Components.Schemas[listName] = kindListSchema(kind.Kind, ref)
			if p := oas.Paths.Paths[base]; p != nil && p.Get != nil {
				setResponseSchemaRef(p.Get, http.StatusOK,
					spec.MustCreateRef("#/components/schemas/"+listName))
			}
		}
	}
}

// kindListSchema mirrors the <Kind>List definition AsKubeOpenAPI produces,
// with refs pointing at components already present in the built spec. The
// ListMeta component is always reachable through the settings kind, so the
// metadata ref never dangles. The SDK-generated List definition is not reused
// directly because it places Default as a $ref sibling, which needs the spec
// builder's allOf ref-wrapping pass that injected components bypass.
func kindListSchema(kind string, itemRef spec.Ref) *spec.Schema {
	return &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Description: kind + "List is a list of " + kind,
			Type:        []string{"object"},
			Properties: map[string]spec.Schema{
				"kind": *spec.StringProperty().WithDescription(
					"Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds"),
				"apiVersion": *spec.StringProperty().WithDescription(
					"APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources"),
				"metadata": {SchemaProps: spec.SchemaProps{
					Ref: spec.MustCreateRef("#/components/schemas/" + v1.ListMeta{}.OpenAPIModelName()),
				}},
				"items": {SchemaProps: spec.SchemaProps{
					Type: []string{"array"},
					Items: &spec.SchemaOrArray{
						Schema: &spec.Schema{SchemaProps: spec.SchemaProps{Ref: itemRef}},
					},
				}},
			},
			Required: []string{"metadata", "items"},
		},
	}
}

// setResponseSchemaRef replaces the schema of every media type in the
// response for the given status code with a reference to the given schema.
func setResponseSchemaRef(op *spec3.Operation, code int, ref spec.Ref) {
	if op.Responses == nil {
		return
	}
	resp := op.Responses.StatusCodeResponses[code]
	if resp == nil {
		return
	}
	for _, mt := range resp.Content {
		mt.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
	}
}

// setOperationRequestResponseBodies points the request body and every
// response body of an operation at the given schema.
func setOperationRequestResponseBodies(op *spec3.Operation, ref spec.Ref) {
	if op == nil {
		return
	}
	if op.RequestBody != nil {
		for _, mt := range op.RequestBody.Content {
			mt.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		}
	}
	setOperationResponseBodies(op, ref)
}

// setOperationResponseBodies points every response body of an operation at
// the given schema, leaving the request body alone.
func setOperationResponseBodies(op *spec3.Operation, ref spec.Ref) {
	if op == nil || op.Responses == nil {
		return
	}
	for _, res := range op.Responses.StatusCodeResponses {
		for _, mt := range res.Content {
			mt.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		}
	}
}

func defaultSchema() *pluginschema.PluginSchema {
	return &pluginschema.PluginSchema{
		SettingsSchema: &pluginschema.Settings{
			Spec: &spec.Schema{
				SchemaProps: spec.SchemaProps{ // The jsonSchema object
					Type:                 []string{"object"},
					AdditionalProperties: &spec.SchemaOrBool{Allows: true},
				},
			},
		},
		SettingsExamples: &pluginschema.SettingsExamples{
			Examples: map[string]*spec3.Example{
				"empty": {
					ExampleProps: spec3.ExampleProps{
						Summary: "example",
						Value: apppluginV0.Settings{
							ObjectMeta: v1.ObjectMeta{
								Name: apppluginV0.INSTANCE_NAME,
							},
							Spec: apppluginV0.SettingsSpec{
								Enabled:  true,
								Pinned:   true,
								JsonData: kcommon.Unstructured{},
							},
						},
					},
				},
			},
		},
	}
}
