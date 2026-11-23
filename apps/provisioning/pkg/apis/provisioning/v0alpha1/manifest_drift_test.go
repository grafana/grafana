package v0alpha1

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/resource"
)

// Generated from apps/provisioning/kinds by `make gen-apps app=provisioning`.
const manifestPath = "../../../../definitions/provisioning-manifest.json"

// External definitions referenced by the Go types but not part of GetOpenAPIDefinitions.
// They are spelled out here so the CUE mirrors in kinds/common.cue are checked too.
var externalGoDefinitions = map[string]spec.Schema{
	"io.k8s.apimachinery.pkg.apis.meta.v1.Duration": *spec.StringProperty(),
}

// Differences that the CUE to OpenAPI conversion cannot avoid, keyed by "<Kind> <path>" and
// matched on the exact difference, so another mismatch at the same path still fails.
// The test fails when one of them stops occurring, so fixed entries get removed.
var knownDifferences = map[string]string{
	// A single-value disjunction becomes `const`, which kube-openapi has no field for.
	"Repository status.deletion.state": "enum is [] in CUE, [Blocked] in Go",
	// Repository status still uses metav1.Condition, which carries date-time; the shared CUE
	// condition matches the string-typed ConnectionCondition until Repository moves to it.
	"Repository status.conditions[].lastTransitionTime": `format is "" in CUE, "date-time" in Go`,
}

func TestManifestMatchesGoTypes(t *testing.T) {
	knownSeen := map[string]bool{}
	t.Cleanup(func() {
		if t.Failed() {
			return
		}
		for key := range knownDifferences {
			if !knownSeen[key] {
				t.Errorf("known difference %q no longer occurs; remove it from knownDifferences", key)
			}
		}
	})

	manifest := loadManifest(t)
	goDefs := GetOpenAPIDefinitionsWithSecureValues(refByName)

	require.Equal(t, GROUP, manifest.Group)
	require.Equal(t, VERSION, manifest.PreferredVersion)

	resourceInfos := []struct {
		kind, resource string
	}{
		{RepositoryResourceInfo.GroupVersionKind().Kind, RepositoryResourceInfo.GetName()},
		{ConnectionResourceInfo.GroupVersionKind().Kind, ConnectionResourceInfo.GetName()},
		{JobResourceInfo.GroupVersionKind().Kind, JobResourceInfo.GetName()},
		{HistoricJobResourceInfo.GroupVersionKind().Kind, HistoricJobResourceInfo.GetName()},
	}

	versionNames := make([]string, 0, len(manifest.Versions))
	for _, version := range manifest.Versions {
		versionNames = append(versionNames, version.Name)

		manifestKinds := map[string]app.ManifestVersionKind{}
		for _, kind := range version.Kinds {
			manifestKinds[kind.Kind] = kind
		}
		require.Len(t, manifestKinds, len(resourceInfos), "version %s declares unexpected kinds", version.Name)

		for _, info := range resourceInfos {
			t.Run(version.Name+"/"+info.kind, func(t *testing.T) {
				kind, ok := manifestKinds[info.kind]
				require.True(t, ok, "kind %s is missing from the manifest", info.kind)
				require.True(t, strings.EqualFold(kind.Plural, info.resource), "plural %q does not match resource %q", kind.Plural, info.resource)
				require.Equal(t, info.resource, kind.Resource, "resource of kind %s", info.kind)
				require.NotNil(t, kind.Schema, "kind %s has no schema", info.kind)

				gvk := schema.GroupVersionKind{Group: manifest.Group, Version: version.Name, Kind: kind.Kind}
				cueDefs, err := kind.Schema.AsKubeOpenAPI(gvk, refByName, "cue", kind.SecureValues...)
				require.NoError(t, err)

				goRoot, ok := goDefs[OpenAPIPrefix+info.kind]
				require.True(t, ok, "no Go OpenAPI definition for %s", info.kind)
				cueRoot, ok := cueDefs["cue."+info.kind]
				require.True(t, ok, "no CUE OpenAPI definition for %s; have %v", info.kind, keys(cueDefs))

				c := &schemaComparer{goDefs: goDefs, cueDefs: cueDefs, seen: map[string]bool{}}
				for _, field := range []string{"spec", "status"} {
					goProp, goHas := goRoot.Schema.Properties[field]
					cueProp, cueHas := cueRoot.Schema.Properties[field]
					require.Equal(t, goHas, cueHas, "%s presence differs", field)
					if goHas {
						c.compare(field, goProp, cueProp)
					}
				}
				c.compareSecure(goRoot.Schema, kind.SecureValues)

				var diffs []string
				for _, d := range c.diffs {
					key := info.kind + " " + d.path
					if knownDifferences[key] == d.message {
						knownSeen[key] = true
						continue
					}
					diffs = append(diffs, "  "+d.path+": "+d.message)
				}
				require.Empty(t, diffs, "CUE manifest (apps/provisioning/kinds) and Go types (pkg/apis/provisioning/v0alpha1) differ for %s; "+
					"update the CUE and run `make gen-apps app=provisioning`:\n%s", info.kind, strings.Join(diffs, "\n"))
			})
		}
	}
	require.ElementsMatch(t, []string{"v0alpha1", "v1beta1"}, versionNames)
}

func loadManifest(t *testing.T) app.ManifestData {
	t.Helper()
	raw, err := os.ReadFile(manifestPath)
	require.NoError(t, err, "run `make gen-apps app=provisioning`")
	var document v1alpha2.AppManifest
	require.NoError(t, json.Unmarshal(raw, &document))
	data, err := document.Spec.ToManifestData()
	require.NoError(t, err)
	return data
}

func refByName(name string) spec.Ref {
	return spec.MustCreateRef(name)
}

func keys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// schemaComparer walks a Go and a CUE schema in lockstep and records structural differences:
// property sets, required fields, types, enums, items and map values. Descriptions, defaults,
// integer formats and list-type markers are ignored because CUE does not carry them the same way.
type schemaComparer struct {
	goDefs  map[string]common.OpenAPIDefinition
	cueDefs map[string]common.OpenAPIDefinition
	seen    map[string]bool
	diffs   []schemaDiff
}

type schemaDiff struct {
	path, message string
}

func (c *schemaComparer) differf(path, format string, args ...any) {
	c.diffs = append(c.diffs, schemaDiff{path: path, message: fmt.Sprintf(format, args...)})
}

func (c *schemaComparer) compare(path string, goSchema, cueSchema spec.Schema) {
	goSchema, goRef := c.resolve(c.goDefs, goSchema)
	cueSchema, cueRef := c.resolve(c.cueDefs, cueSchema)
	if goRef != "" && cueRef != "" {
		pair := goRef + "|" + cueRef
		if c.seen[pair] {
			return
		}
		c.seen[pair] = true
	}

	if got, want := normalizedType(cueSchema), normalizedType(goSchema); got != want {
		c.differf(path, "type is %q in CUE, %q in Go", got, want)
		return
	}
	if normalizedType(goSchema) == "string" && cueSchema.Format != goSchema.Format {
		c.differf(path, "format is %q in CUE, %q in Go", cueSchema.Format, goSchema.Format)
	}
	if got, want := enumValues(cueSchema), enumValues(goSchema); !slices.Equal(got, want) {
		c.differf(path, "enum is %v in CUE, %v in Go", got, want)
	}
	if got, want := sorted(cueSchema.Required), sorted(goSchema.Required); !slices.Equal(got, want) {
		c.differf(path, "required is %v in CUE, %v in Go", got, want)
	}

	for name, goProp := range goSchema.Properties {
		cueProp, ok := cueSchema.Properties[name]
		if !ok {
			c.differf(path+"."+name, "missing in CUE")
			continue
		}
		c.compare(path+"."+name, goProp, cueProp)
	}
	for name := range cueSchema.Properties {
		if _, ok := goSchema.Properties[name]; !ok {
			c.differf(path+"."+name, "missing in Go")
		}
	}

	if got, want := allowsAnyProperty(cueSchema), allowsAnyProperty(goSchema); got != want {
		c.differf(path, "additionalProperties: true is %v in CUE, %v in Go", got, want)
	}
	c.compareNested(path+"[]", "array items", itemsSchema(goSchema), itemsSchema(cueSchema))
	c.compareNested(path+"{}", "map values", mapValueSchema(goSchema), mapValueSchema(cueSchema))
}

func (c *schemaComparer) compareNested(path, what string, goSchema, cueSchema *spec.Schema) {
	switch {
	case goSchema == nil && cueSchema == nil:
	case cueSchema == nil:
		c.differf(path, "%s missing in CUE", what)
	case goSchema == nil:
		c.differf(path, "%s missing in Go", what)
	default:
		c.compare(path, *goSchema, *cueSchema)
	}
}

func itemsSchema(s spec.Schema) *spec.Schema {
	if s.Items == nil {
		return nil
	}
	return s.Items.Schema
}

func mapValueSchema(s spec.Schema) *spec.Schema {
	if s.AdditionalProperties == nil || s.AdditionalProperties.Schema == nil || isEmptySchema(*s.AdditionalProperties.Schema) {
		return nil
	}
	return s.AdditionalProperties.Schema
}

// allowsAnyProperty reports additionalProperties: true. CUE closes its structs with false where
// Go leaves it unset; both drop unknown fields, so only true is compared. Map value schemas are
// compared separately.
func allowsAnyProperty(s spec.Schema) bool {
	return s.AdditionalProperties != nil && s.AdditionalProperties.Schema == nil && s.AdditionalProperties.Allows
}

func (c *schemaComparer) compareSecure(goRoot spec.Schema, cueSecure []app.ManifestVersionKindSecureValue) {
	cueKeys := make([]string, 0, len(cueSecure))
	for _, value := range cueSecure {
		cueKeys = append(cueKeys, value.Key)
	}
	inlineSecureValue := resource.InlineSecureValue{}.OpenAPIModelName()
	var goKeys []string
	if prop, ok := goRoot.Properties["secure"]; ok {
		secure, _ := c.resolve(c.goDefs, prop)
		for name, value := range secure.Properties {
			goKeys = append(goKeys, name)
			if ref := refOf(value); ref != inlineSecureValue {
				c.differf("secure."+name, "Go type is %q, expected an InlineSecureValue", ref)
			}
		}
	}
	if got, want := sorted(cueKeys), sorted(goKeys); !slices.Equal(got, want) {
		c.differf("secure", "keys are %v in CUE, %v in Go", got, want)
	}
}

// resolve follows $ref (also when wrapped in a single-element allOf) and returns the target schema and its name.
func (c *schemaComparer) resolve(defs map[string]common.OpenAPIDefinition, s spec.Schema) (spec.Schema, string) {
	for range 10 {
		ref := refOf(s)
		if ref == "" {
			return s, ""
		}
		if def, ok := defs[ref]; ok {
			s = def.Schema
			if refOf(s) == "" {
				return s, ref
			}
			continue
		}
		if ext, ok := externalGoDefinitions[ref]; ok {
			return ext, ref
		}
		c.differf(ref, "unresolvable reference")
		return spec.Schema{}, ref
	}
	return s, ""
}

func refOf(s spec.Schema) string {
	if ref := s.Ref.String(); ref != "" {
		return ref
	}
	if len(s.AllOf) == 1 && len(s.Properties) == 0 {
		return s.AllOf[0].Ref.String()
	}
	return ""
}

func normalizedType(s spec.Schema) string {
	t := strings.Join(s.Type, "|")
	if t == "" && len(s.Properties) > 0 {
		return "object"
	}
	if t == "object" && len(s.Properties) == 0 && acceptsAnyValue(s.AdditionalProperties) {
		// An open object and an untyped value both accept anything.
		return ""
	}
	return t
}

func enumValues(s spec.Schema) []string {
	out := make([]string, 0, len(s.Enum))
	for _, v := range s.Enum {
		out = append(out, fmt.Sprint(v))
	}
	return sorted(out)
}

func sorted(in []string) []string {
	out := slices.Clone(in)
	sort.Strings(out)
	return out
}

// acceptsAnyValue reports whether additionalProperties leaves an object open: unset, true, or
// the empty schema that CUE emits for `_`. A closed object (false) is still an object.
func acceptsAnyValue(ap *spec.SchemaOrBool) bool {
	if ap == nil {
		return true
	}
	if ap.Schema == nil {
		return ap.Allows
	}
	return isEmptySchema(*ap.Schema)
}

func isEmptySchema(s spec.Schema) bool {
	return reflect.DeepEqual(s, spec.Schema{})
}
