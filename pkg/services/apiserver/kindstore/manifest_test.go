package kindstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
)

func testVersionSchema(t *testing.T, raw string) *app.VersionSchema {
	t.Helper()

	var schema app.VersionSchema
	require.NoError(t, json.Unmarshal([]byte(raw), &schema))
	return &schema
}

// testManifest declares one kind across two versions: v0alpha1 without a status,
// v1alpha1 with one and with a schema deep enough to exercise ref expansion.
func testManifest(t *testing.T) *app.ManifestData {
	t.Helper()

	return &app.ManifestData{
		AppName:          "example",
		Group:            "example.ext.grafana.app",
		PreferredVersion: "v1alpha1",
		Versions: []app.ManifestVersion{
			{
				Name:   "v0alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "TestKind",
					Plural: "TestKinds",
					Scope:  "Namespaced",
					Schema: testVersionSchema(t, `{
						"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
						"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"integer"}},"required":["testField"]}
					}`),
				}},
			},
			{
				Name:   "v1alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "TestKind",
					Plural: "TestKinds",
					Scope:  "Namespaced",
					Schema: testVersionSchema(t, `{
						"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"},"status":{"$ref":"#/components/schemas/status"}},"required":["spec"]},
						"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"},"foo":{"$ref":"#/components/schemas/Foo"}},"required":["testField","foo"]},
						"status":{"type":"object","additionalProperties":true},
						"Foo":{"type":"object","additionalProperties":false,"properties":{"foo":{"type":"string"},"bar":{"$ref":"#/components/schemas/Bar"}},"required":["foo","bar"]},
						"Bar":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"string"},"baz":{"$ref":"#/components/schemas/Baz"}},"required":["value","baz"]},
						"Baz":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"integer"}},"required":["value"]}
					}`),
				}},
			},
		},
	}
}
