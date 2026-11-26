package definition

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
)

func testPluginSchema() *pluginschema.PluginSchema {
	return &pluginschema.PluginSchema{
		SettingsSchema: &pluginschema.Settings{
			Spec: &spec.Schema{SchemaProps: spec.SchemaProps{
				Type:       []string{"object"},
				Properties: map[string]spec.Schema{"message": *spec.StringProperty()},
				Required:   []string{"message"},
			}},
			SecureValues: []pluginschema.SecureValueInfo{{Key: "apiKey", Description: "a secret", Required: true}},
		},
		Routes: &pluginschema.Routes{
			Paths: map[string]*spec3.Path{
				"/resources/clients": {PathProps: spec3.PathProps{Get: &spec3.Operation{OperationProps: spec3.OperationProps{
					OperationId: "getClients",
					Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{
						200: {ResponseProps: spec3.ResponseProps{Content: map[string]*spec3.MediaType{
							"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: spec.RefSchema("#/components/schemas/ClientResults")}},
						}}},
					}}},
				}}}},
				// The schema does not say where a proxy route forwards to.
				"/proxy/remote": {PathProps: spec3.PathProps{Get: &spec3.Operation{}}},
			},
			Components: &spec3.Components{Schemas: map[string]*spec.Schema{
				"ClientResults": {SchemaProps: spec.SchemaProps{Type: []string{"object"}}},
			}},
		},
	}
}

func TestNewSettingsManifestPublishesThePluginSchema(t *testing.T) {
	p := appWithRoutes(nil)
	p.Schemas = map[string]*pluginschema.PluginSchema{SettingsAPIVersion: testPluginSchema()}
	manifest, err := NewSettingsManifest(p, testMatcher)
	require.NoError(t, err)
	require.Len(t, manifest.Versions, 1)
	version := manifest.Versions[0]
	require.Len(t, version.Kinds, 1)
	kind := version.Kinds[0]

	require.NotNil(t, kind.Schema, "the settings kind is described by the plugin's settings spec")
	schemas := kind.Schema.AsOpenAPI3SchemasMap()
	require.Contains(t, schemas, "Settings")
	raw, err := json.Marshal(schemas[settingsSpecSchemaName])
	require.NoError(t, err)
	require.JSONEq(t, `{"type":"object","properties":{
		"enabled":{"type":"boolean","description":"can be executed"},
		"jsonData":{"type":"object","properties":{"message":{"type":"string"}},"required":["message"]}
	}}`, string(raw))
	require.Equal(t, []app.ManifestVersionKindSecureValue{{Key: "apiKey", Description: "a secret"}}, kind.SecureValues)

	clients := version.OpenAPI.Paths[SettingsResourcesRoot+"/clients"]
	require.NotNil(t, clients.Get, "the schema's resource routes are published")
	require.Equal(t, "getClients", clients.Get.OperationId)
	require.NotContains(t, version.OpenAPI.Paths, SettingsProxyRoot+"/remote", "proxy routes need a forwarding target")
	require.Contains(t, version.OpenAPI.Components.Schemas, "ClientResults", "with the components they refer to")

	// The manifest renders as discovery serves it.
	spec, err := v1alpha2.SpecFromManifestData(*manifest)
	require.NoError(t, err)
	require.Contains(t, spec.Versions[0].Kinds[0].Schemas, "Settings")
	require.Contains(t, spec.Versions[0].Openapi.Paths, SettingsResourcesRoot+"/clients")

	// The manifest has its own copy of the routes.
	clients.Get.OperationId = "changed"
	require.Equal(t, "getClients", p.Schemas[SettingsAPIVersion].Routes.Paths["/resources/clients"].Get.OperationId)
}

func TestNewSettingsManifestKeepsWhatItsFoundationDeclares(t *testing.T) {
	foundation := &app.ManifestData{AppName: "example-app", Group: "example-app", Versions: []app.ManifestVersion{{
		Name:   SettingsAPIVersion,
		Served: true,
		OpenAPI: app.ManifestVersionOpenAPI{
			Paths: map[string]spec3.PathProps{
				SettingsResourcesRoot + "/clients": {Get: &spec3.Operation{OperationProps: spec3.OperationProps{OperationId: "declared"}}},
			},
			Components: app.ManifestVersionOpenAPIComponents{Schemas: map[string]spec.Schema{
				"ClientResults": {SchemaProps: spec.SchemaProps{Description: "declared"}},
			}},
		},
	}}}
	p := appWithRoutes(nil, foundation)
	p.Schemas = map[string]*pluginschema.PluginSchema{SettingsAPIVersion: testPluginSchema()}
	manifest, err := NewSettingsManifest(p, testMatcher)
	require.NoError(t, err)
	version := manifest.Versions[0]
	require.Equal(t, "declared", version.OpenAPI.Paths[SettingsResourcesRoot+"/clients"].Get.OperationId)
	require.Equal(t, "declared", version.OpenAPI.Components.Schemas["ClientResults"].Description)
	require.NotNil(t, version.Kinds[0].Schema, "the settings spec is still added")
	require.Len(t, foundation.Versions[0].OpenAPI.Components.Schemas, 1, "the foundation is left unchanged")
}

func TestNewSettingsManifestWithoutAPluginSchema(t *testing.T) {
	for name, schemas := range map[string]map[string]*pluginschema.PluginSchema{
		"no schema":                 nil,
		"a schema without settings": {SettingsAPIVersion: {Routes: testPluginSchema().Routes}},
	} {
		t.Run(name, func(t *testing.T) {
			p := appWithRoutes(nil)
			p.Schemas = schemas
			manifest, err := NewSettingsManifest(p, testMatcher)
			require.NoError(t, err)
			kind := manifest.Versions[0].Kinds[0]
			require.NotNil(t, kind.Schema, "the settings kind is always described")
			raw, err := json.Marshal(kind.Schema.AsOpenAPI3SchemasMap()[settingsSpecSchemaName])
			require.NoError(t, err)
			require.JSONEq(t, `{"type":"object","properties":{
				"enabled":{"type":"boolean","description":"can be executed"},
				"jsonData":{"type":"object","additionalProperties":true}
			}}`, string(raw), "jsonData is any object")
			require.Empty(t, kind.SecureValues)
		})
	}
}
