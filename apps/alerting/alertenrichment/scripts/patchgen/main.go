// Command patchgen patches app-sdk output so the generated API matches the hand-written v1beta1 types.
//
// cog cannot express these in CUE:
//   - an empty CUE struct becomes interface{}, which persists arbitrary fields;
//     the hand-written placeholder enrichers are empty structs that drop them.
//   - the kind-level spec schema is always closed (additionalProperties: false).
//   - x-kubernetes-list-type / list-map-keys markers.
//   - defaults on $ref fields, and int32 formats.
//   - Go field types other than the CUE primitives (metav1.Duration, non-pointer optionals).
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go/format"
	"os"
	"regexp"
	"strings"
)

var placeholders = []string{
	"SiftEnricher",
	"AssertsEnricher",
	"LoopEnricher",
	"AssistantEnricher",
	"QuerySampleEnricher",
}

// fieldTypes restore the hand-written Go field types, so stored JSON round-trips unchanged:
// metav1.Duration validates and normalizes timeouts, and non-pointer optionals drop zero values.
var fieldTypes = []struct{ field, generated, handWritten, tag string }{
	{"Timeout", "string", "metav1.Duration", `json:"timeout"`},
	{"Description", "*string", "string", `json:"description,omitempty"`},
	{"RefId", "*string", "string", `json:"refId,omitempty"`},
	{"DataSourceUid", "*string", "string", `json:"dataSourceUid,omitempty"`},
	{"MaxLines", "*int32", "int32", `json:"maxLines,omitempty"`},
}

const metav1Import = `metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"`

var (
	modelPrefix = regexp.MustCompile(`return "(com\.github\.grafana\.grafana\.apps\.alerting\.alertenrichment\.pkg\.generated\.alertenrichment\.v1beta1)\.`)
	schemaVar   = regexp.MustCompile("(?m)^(\\s*rawSchemaAlertEnrichmentv1beta1\\s+= \\[\\]byte\\(`)(.*)(`\\))$")
)

// backtickSplice is how the generator embeds a backtick inside a Go raw string literal.
const backtickSplice = "` + \"`\" + `"

func main() {
	if len(os.Args) != 3 {
		fail("usage: %s <spec_gen.go> <manifest.go>", os.Args[0])
	}
	specPath, manifestPath := os.Args[1], os.Args[2]
	rewriteFile(specPath, patchSpec)
	rewriteFile(manifestPath, patchManifest)
}

func rewriteFile(path string, patch func(string) (string, error)) {
	src, err := os.ReadFile(path)
	if err != nil {
		fail("%v", err)
	}
	out, err := patch(string(src))
	if err != nil {
		fail("%s: %v", path, err)
	}
	formatted, err := format.Source([]byte(out))
	if err != nil {
		fail("%s: gofmt: %v", path, err)
	}
	if err := os.WriteFile(path, formatted, 0o644); err != nil {
		fail("%v", err)
	}
}

func patchSpec(spec string) (string, error) {
	m := modelPrefix.FindStringSubmatch(spec)
	if m == nil {
		return "", fmt.Errorf("could not find generated OpenAPI model name prefix")
	}
	prefix := m[1]

	for _, name := range placeholders {
		goName := "AlertEnrichment" + name
		typePattern := regexp.MustCompile(`type ` + goName + ` (?:map\[string\]interface\{\}|interface\{\}|struct\{\})\n`)
		if n := len(typePattern.FindAllStringIndex(spec, -1)); n != 1 {
			return "", fmt.Errorf("expected one Go type for %s, found %d", name, n)
		}
		replacement := "type " + goName + " struct{}\n"
		if !strings.Contains(spec, "func ("+goName+") OpenAPIModelName()") {
			replacement += fmt.Sprintf("\n// OpenAPIModelName returns the OpenAPI model name for %[1]s.\n"+
				"func (%[1]s) OpenAPIModelName() string {\n\treturn \"%[2]s.%[1]s\"\n}\n", goName, prefix)
		}
		spec = typePattern.ReplaceAllLiteralString(spec, replacement)
	}

	for _, f := range fieldTypes {
		pattern := regexp.MustCompile(`(?m)^(\t` + f.field + ` )(?:` + regexp.QuoteMeta(f.generated) + `|` +
			regexp.QuoteMeta(f.handWritten) + `)( ` + "`" + regexp.QuoteMeta(f.tag) + "`" + `)$`)
		if n := len(pattern.FindAllStringIndex(spec, -1)); n != 1 {
			return "", fmt.Errorf("expected one %s field, found %d", f.field, n)
		}
		spec = pattern.ReplaceAllString(spec, "${1}"+f.handWritten+"${2}")
	}
	if !strings.Contains(spec, metav1Import) {
		spec = strings.Replace(spec, "package v1beta1\n", "package v1beta1\n\nimport "+metav1Import+"\n", 1)
	}
	return spec, nil
}

func patchManifest(manifest string) (string, error) {
	loc := schemaVar.FindStringSubmatchIndex(manifest)
	if loc == nil {
		return "", fmt.Errorf("could not find raw schema")
	}
	raw := strings.ReplaceAll(manifest[loc[4]:loc[5]], backtickSplice, "`")

	var schemas map[string]any
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&schemas); err != nil {
		return "", fmt.Errorf("decode raw schema: %w", err)
	}
	if encoded, err := encode(schemas); err != nil || encoded != raw {
		return "", fmt.Errorf("raw schema does not round-trip through encoding/json; refusing to rewrite")
	}
	if err := patchSchemas(schemas); err != nil {
		return "", err
	}
	encoded, err := encode(schemas)
	if err != nil {
		return "", err
	}
	return manifest[:loc[4]] + strings.ReplaceAll(encoded, "`", backtickSplice) + manifest[loc[5]:], nil
}

func patchSchemas(schemas map[string]any) error {
	spec, err := object(schemas, "spec")
	if err != nil {
		return err
	}
	spec["additionalProperties"] = map[string]any{}

	set := func(schema, field, key string, value any) error {
		p, err := object(schemas, schema, "properties", field)
		if err != nil {
			return err
		}
		p[key] = value
		return nil
	}
	// The kind's spec must stay a bare $ref: the app-sdk treats the schema as CRD-shaped otherwise.
	if err := defaultRef(schemas, "Conditional", "if", map[string]any{}); err != nil {
		return err
	}
	for _, s := range []struct {
		schema, field, key string
		value              any
	}{
		{"spec", "alertRuleUids", "x-kubernetes-list-type", "set"},
		{"spec", "receivers", "x-kubernetes-list-type", "set"},
		{"AssignEnricher", "annotations", "x-kubernetes-list-type", "map"},
		{"AssignEnricher", "annotations", "x-kubernetes-list-map-keys", []any{"name"}},
		{"LogsDataSourceQuery", "maxLines", "format", "int32"},
	} {
		if err := set(s.schema, s.field, s.key, s.value); err != nil {
			return err
		}
	}
	return nil
}

// defaultRef sets a default on a $ref property. Siblings of $ref are dropped when the
// app-sdk converts the schema to kube-openapi, so the $ref is wrapped in allOf.
func defaultRef(schemas map[string]any, schema, field string, value any) error {
	p, err := object(schemas, schema, "properties", field)
	if err != nil {
		return err
	}
	if ref, ok := p["$ref"]; ok {
		delete(p, "$ref")
		p["allOf"] = []any{map[string]any{"$ref": ref}}
	} else if _, ok := p["allOf"]; !ok {
		return fmt.Errorf("%s.%s has neither $ref nor allOf", schema, field)
	}
	p["default"] = value
	return nil
}

func object(root map[string]any, path ...string) (map[string]any, error) {
	cur := root
	for _, key := range path {
		next, ok := cur[key].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("schema path %s not found", strings.Join(path, "."))
		}
		cur = next
	}
	return cur, nil
}

// encode matches the generator's json.Marshal output: sorted keys, HTML escaping, no trailing newline.
func encode(v any) (string, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buf.String(), "\n"), nil
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "patchgen: "+format+"\n", args...)
	os.Exit(1)
}
