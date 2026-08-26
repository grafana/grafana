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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		base := apppluginV0.GetOpenAPIDefinitions(ref)
		if b.manifest != nil {
			maps.Copy(base, loadOpenAPIDefinitions(ref, b.manifest))

			// Server-side apply finds manifest GVKs through these generic route models.
			base[openapiutil.GetCanonicalTypeName(unstructured.Unstructured{})] = b.unstructuredOpenAPIDefinition("")
			base[openapiutil.GetCanonicalTypeName(unstructured.UnstructuredList{})] = b.unstructuredOpenAPIDefinition("List")
		}
		return base
	}
}

// kindOpenAPIName returns the definition and component name for a manifest kind.
func kindOpenAPIName(gvk schema.GroupVersionKind) string {
	return gvk.Group + "." + gvk.Version + "." + gvk.Kind
}

// unstructuredOpenAPIDefinition adds the GVK metadata required by server-side apply.
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

// loadOpenAPIDefinitions loads schemas for all served kinds.
func loadOpenAPIDefinitions(ref common.ReferenceCallback, manifest *app.ManifestData) map[string]common.OpenAPIDefinition {
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
				continue
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
			// The settings kind uses the same schema in every version.
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

	return definition.AugmentOpenAPI(oas, definition.SettingsResource{
		Schema:   schema,
		Resource: ps,
		SpecName: "SettingsSpec",
		Path:     root + "namespaces/{namespace}/app",
		IsApp:    true,
	})
}

// specVersion reads the group version from the title set by the API builder.
func (b *AppPluginAPIBuilder) specVersion(oas *spec3.OpenAPI) string {
	if oas.Info != nil {
		if version, ok := strings.CutPrefix(oas.Info.Title, b.pluginJSON.ID+"/"); ok && version != "" {
			return version
		}
	}
	return apppluginV0.VERSION
}

// postProcessManifestKinds replaces generic route schemas with manifest schemas.
func (b *AppPluginAPIBuilder) postProcessManifestKinds(oas *spec3.OpenAPI, root string, version string) {
	if b.manifest == nil || oas.Components == nil || oas.Components.Schemas == nil {
		return
	}

	defs := loadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef("#/components/schemas/" + name)
	}, b.manifest)
	prefix := b.manifest.Group + "." + version + "."
	for name, def := range defs {
		if strings.HasPrefix(name, prefix) {
			s := def.Schema
			oas.Components.Schemas[name] = &s
		}
	}

	info := &operationInfo{defs: defs}
	gvk := schema.GroupVersionKind{Group: b.manifest.Group}
	for _, v := range b.manifest.Versions {
		if v.Name != version || !v.Served {
			continue
		}
		gvk.Version = v.Name
		for _, kind := range v.Kinds {
			if kind.Schema == nil {
				continue
			}
			gvk.Kind = kind.Kind
			name := kindOpenAPIName(gvk)
			ref := spec.MustCreateRef("#/components/schemas/" + name)
			base := root + "namespaces/{namespace}/" + strings.ToLower(kind.Plural)
			if kind.Scope == clusterScope {
				base = root + strings.ToLower(kind.Plural)
			}

			info.kind = &kind
			info.gvk = gvk
			info.name = name

			// PATCH requests contain patch documents, not full resources.
			for _, path := range []string{base, base + "/{name}", base + "/{name}/status"} {
				if p := oas.Paths.Paths[path]; p != nil {
					for _, op := range []*spec3.Operation{p.Get, p.Put, p.Post} {
						info.isPOST = p.Post == op
						setOperationRequestResponseBodies(op, ref, info)
					}
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

// kindListSchema builds a list without kube-openapi's unavailable ref-wrapping pass.
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

// setResponseSchemaRef updates every media type for one response code.
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

// setOperationRequestResponseBodies updates an operation's request and responses.
func setOperationRequestResponseBodies(op *spec3.Operation, ref spec.Ref, info *operationInfo) {
	if op == nil {
		return
	}
	if op.RequestBody != nil {
		for _, mt := range op.RequestBody.Content {
			mt.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

			if info.isPOST {
				example := &unstructured.Unstructured{}
				example.SetAPIVersion(info.gvk.GroupVersion().String())
				example.SetKind(info.gvk.Kind)
				example.SetGenerateName("x")
				if info.kind.FolderScoped != nil && *info.kind.FolderScoped {
					example.SetAnnotations(map[string]string{
						utils.AnnoKeyFolder: "{folder-name}",
					})
				}

				// SPEC -- TODO? add an example in the manifest
				if prop := info.specProperty(); prop != nil {
					if v := info.exampleValue(prop, map[string]bool{}); v != nil {
						example.Object["spec"] = v
					}
				}

				mt.Example = example
			}
		}
	}
	setOperationResponseBodies(op, ref)
}

// setOperationResponseBodies updates every response body for an operation.
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

type operationInfo struct {
	defs   map[string]common.OpenAPIDefinition
	gvk    schema.GroupVersionKind
	kind   *app.ManifestVersionKind
	name   string // schema name {group}.{version}.{kind}
	isPOST bool
}

// specProperty returns the kind's spec property. It is usually a $ref into the
// manifest definitions, so it must be resolved before it can be walked.
func (info *operationInfo) specProperty() *spec.Schema {
	def, ok := info.defs[info.name]
	if !ok {
		return nil
	}
	prop, ok := def.Schema.Properties["spec"]
	if !ok {
		return nil
	}
	return &prop
}

// refName returns the definition key a $ref points at. Manifest refs are
// written as "#/components/schemas/{group}.{version}.{Kind}{Field}".
func refName(ref spec.Ref) string {
	s := ref.String()
	if i := strings.LastIndex(s, "/"); i >= 0 {
		return s[i+1:]
	}
	return s
}

// exampleValue builds a placeholder value for a schema, resolving $refs against
// the manifest definitions. visited holds the refs on the current path so a
// self-referencing kind (a tree node containing itself) terminates.
func (info *operationInfo) exampleValue(s *spec.Schema, visited map[string]bool) any {
	if s == nil {
		return nil
	}
	if name := refName(s.Ref); name != "" {
		def, ok := info.defs[name]
		if !ok || visited[name] {
			// Unknown (eg ObjectMeta) or recursive -- stop expanding here.
			return map[string]any{}
		}
		visited[name] = true
		defer delete(visited, name)
		s = &def.Schema
	}
	switch {
	case s.Example != nil:
		return s.Example
	case s.Default != nil:
		return s.Default
	case len(s.Enum) > 0:
		return s.Enum[0]
	}
	switch {
	case len(s.Properties) > 0:
		obj := map[string]any{}
		for k, prop := range s.Properties {
			if prop.ReadOnly {
				continue
			}
			obj[k] = info.exampleValue(&prop, visited)
		}
		return obj
	case s.Type.Contains("array"):
		if s.Items != nil && s.Items.Schema != nil {
			return []any{info.exampleValue(s.Items.Schema, visited)}
		}
		return []any{}
	case s.Type.Contains("object"):
		obj := map[string]any{}
		if s.AdditionalProperties != nil && s.AdditionalProperties.Schema != nil {
			obj["key"] = info.exampleValue(s.AdditionalProperties.Schema, visited)
		}
		return obj
	case s.Type.Contains("string"):
		return exampleString(s.Format)
	case s.Type.Contains("integer"):
		return 0
	case s.Type.Contains("number"):
		return 0.0
	case s.Type.Contains("boolean"):
		return false
	}
	return nil
}

// exampleString returns a value that satisfies the common string formats, since
// a plain "example" is rejected by clients validating format.
func exampleString(format string) string {
	switch format {
	case "date-time":
		return "2020-01-02T15:04:05Z"
	case "date":
		return "2020-01-02"
	case "duration":
		return "5m"
	case "uuid":
		return "00000000-0000-0000-0000-000000000000"
	case "email":
		return "user@example.com"
	case "uri", "url":
		return "https://example.com"
	case "byte":
		return "ZXhhbXBsZQ=="
	}
	return "example"
}
