package placeholder_test

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/apps/alerting/alertenrichment/pkg/generated/alertenrichment/v1beta1"
	"github.com/grafana/grafana/apps/alerting/alertenrichment/pkg/generated/manifestdata"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func TestPlaceholderEnrichersDropUnknownFields(t *testing.T) {
	t.Parallel()

	enrichers := []any{
		&v1beta1.AlertEnrichmentSiftEnricher{},
		&v1beta1.AlertEnrichmentAssertsEnricher{},
		&v1beta1.AlertEnrichmentLoopEnricher{},
		&v1beta1.AlertEnrichmentAssistantEnricher{},
		&v1beta1.AlertEnrichmentQuerySampleEnricher{},
	}
	for _, enricher := range enrichers {
		if err := json.Unmarshal([]byte(`{"unexpected":"value"}`), enricher); err != nil {
			t.Fatalf("unmarshal %T: %v", enricher, err)
		}
		encoded, err := json.Marshal(enricher)
		if err != nil {
			t.Fatalf("marshal %T: %v", enricher, err)
		}
		if string(encoded) != "{}" {
			t.Fatalf("%T persisted unknown fields: %s", enricher, encoded)
		}
	}
}

func TestSchemaMatchesHandWrittenTypes(t *testing.T) {
	t.Parallel()

	schemas := manifestdata.LocalManifest().ManifestData.Versions[0].Kinds[0].Schema.AsOpenAPI3SchemasMap()
	schema := func(name string) map[string]any {
		t.Helper()
		s, ok := schemas[name].(map[string]any)
		if !ok {
			t.Fatalf("%s schema missing", name)
		}
		return s
	}
	property := func(name, field string) map[string]any {
		t.Helper()
		p, ok := schema(name)["properties"].(map[string]any)[field].(map[string]any)
		if !ok {
			t.Fatalf("%s.%s schema missing", name, field)
		}
		return p
	}

	t.Run("objects accept unknown fields", func(t *testing.T) {
		for _, name := range []string{
			"spec", "Step", "Conditional", "Condition", "Matcher", "EnricherConfig", "AssignEnricher",
			"Assignment", "ExternalEnricher", "DataSourceEnricher", "RawDataSourceQuery", "LogsDataSourceQuery",
			"ExplainEnricher", "SiftEnricher", "AssertsEnricher", "LoopEnricher", "AssistantEnricher", "QuerySampleEnricher",
		} {
			if ap, ok := schema(name)["additionalProperties"]; !ok || ap == false {
				t.Errorf("%s additionalProperties = %#v", name, ap)
			}
		}
		if ap := property("RawDataSourceQuery", "request")["additionalProperties"]; ap != true {
			t.Errorf("request additionalProperties = %#v", ap)
		}
	})

	t.Run("list types", func(t *testing.T) {
		for _, field := range []string{"alertRuleUids", "receivers"} {
			if lt := property("spec", field)["x-kubernetes-list-type"]; lt != "set" {
				t.Errorf("spec.%s list type = %#v", field, lt)
			}
		}
		annotations := property("AssignEnricher", "annotations")
		if lt := annotations["x-kubernetes-list-type"]; lt != "map" {
			t.Errorf("annotations list type = %#v", lt)
		}
		keys, _ := annotations["x-kubernetes-list-map-keys"].([]any)
		if len(keys) != 1 || keys[0] != "name" {
			t.Errorf("annotations list map keys = %#v", annotations["x-kubernetes-list-map-keys"])
		}
	})

	t.Run("defaults", func(t *testing.T) {
		for _, f := range [][2]string{
			{"spec", "title"}, {"Assignment", "name"}, {"Assignment", "value"}, {"Matcher", "name"},
			{"Matcher", "value"}, {"ExplainEnricher", "annotation"}, {"ExternalEnricher", "url"},
			{"LogsDataSourceQuery", "dataSourceType"}, {"LogsDataSourceQuery", "expr"},
		} {
			if d, ok := property(f[0], f[1])["default"]; !ok || d != "" {
				t.Errorf("%s.%s default = %#v", f[0], f[1], d)
			}
		}
		if d, ok := property("Conditional", "if")["default"].(map[string]any); !ok || len(d) != 0 {
			t.Errorf("Conditional.if default = %#v", property("Conditional", "if")["default"])
		}
	})

	t.Run("maxLines is int32", func(t *testing.T) {
		if f := property("LogsDataSourceQuery", "maxLines")["format"]; f != "int32" {
			t.Errorf("maxLines format = %#v", f)
		}
	})
}

func TestRefDefaultsSurviveKubeOpenAPIConversion(t *testing.T) {
	t.Parallel()

	m := manifestdata.LocalManifest().ManifestData
	v := m.Versions[0]
	gvk := schema.GroupVersionKind{Group: m.Group, Version: v.Name, Kind: v.Kinds[0].Kind}
	defs, err := v.Kinds[0].Schema.AsKubeOpenAPI(gvk, func(p string) spec.Ref {
		return spec.MustCreateRef("#/definitions/" + p)
	}, "pkg")
	if err != nil {
		t.Fatal(err)
	}

	def, ok := defs["pkg.AlertEnrichmentConditional"]
	if !ok {
		t.Fatal("Conditional definition missing")
	}
	p := def.Schema.Properties["if"]
	if d, ok := p.Default.(map[string]any); !ok || len(d) != 0 {
		t.Errorf("if default = %#v", p.Default)
	}
	if len(p.AllOf) != 1 || p.AllOf[0].Ref.String() == "" {
		t.Errorf("if allOf = %#v", p.AllOf)
	}
}
