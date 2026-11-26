package definition

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
)

// settingsSpecSchemaName names the settings spec in the Settings kind's
// schema, which refers to it as the kind schemas the app-sdk generates do.
const settingsSpecSchemaName = "spec"

// withPluginSchema adds to the settings manifest's Settings kind and version
// what the plugin's schema for the settings API version describes, so the
// manifest publishes it as the settings API does: the settings spec, with
// jsonData as the schema defines it, its secure values, and the routes below
// the resources subresource with the components they refer to. What the
// settings manifest's foundation declares is kept: a route, or a component,
// it declares under the same name is not replaced.
//
// Only resource routes are taken from the schema. A proxy route must say
// where it forwards to, which the schema does not.
func withPluginSchema(kind *app.ManifestVersionKind, version *app.ManifestVersion, resources map[string]spec3.PathProps, schema *pluginschema.PluginSchema) error {
	if schema.IsZero() {
		return nil
	}
	var errs []error
	if settings := schema.SettingsSchema; !settings.IsZero() {
		if err := withSettingsSchema(kind, settings); err != nil {
			errs = append(errs, fmt.Errorf("the settings schema is left out: %w", err))
		}
	}
	routes := schema.Routes
	if routes.IsZero() {
		return errors.Join(errs...)
	}
	for _, path := range slices.Sorted(maps.Keys(routes.Paths)) {
		item := routes.Paths[path]
		if item == nil || !IsBelow(path, "/resources") {
			continue
		}
		declared := settingsObjectRoot + path
		if _, ok := resources[declared]; ok {
			continue
		}
		props, err := clonePathProps(item.PathProps)
		if err != nil {
			errs = append(errs, fmt.Errorf("schema route %s is left out: %w", path, err))
			continue
		}
		resources[declared] = props
	}
	if c := routes.Components; c != nil {
		components := &version.OpenAPI.Components
		for name, s := range c.Schemas {
			if s == nil {
				continue
			}
			if _, ok := components.Schemas[name]; ok {
				continue
			}
			if components.Schemas == nil {
				components.Schemas = map[string]spec.Schema{}
			}
			components.Schemas[name] = *s
		}
		addMissingComponents(&components.Responses, c.Responses)
		addMissingComponents(&components.Examples, c.Examples)
	}
	return errors.Join(errs...)
}

// withSettingsSchema sets kind's schema to the settings object: its spec, with
// enabled and jsonData as the settings API describes them, and its secure
// values. A kind schema the foundation declares is kept.
func withSettingsSchema(kind *app.ManifestVersionKind, settings *pluginschema.Settings) error {
	for _, v := range settings.SecureValues {
		if !slices.ContainsFunc(kind.SecureValues, func(s app.ManifestVersionKindSecureValue) bool { return s.Key == v.Key }) {
			kind.SecureValues = append(kind.SecureValues, app.ManifestVersionKindSecureValue{Key: v.Key, Description: v.Description})
		}
	}
	if kind.Schema != nil || settings.Spec == nil {
		return nil
	}
	settingsSpec, err := toMap(AppSettingsSpec(settings))
	if err != nil {
		return err
	}
	schema, err := app.VersionSchemaFromMap(map[string]any{
		kind.Kind: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"spec": map[string]any{"$ref": "#/components/schemas/" + settingsSpecSchemaName},
			},
			"required": []any{"spec"},
		},
		settingsSpecSchemaName: settingsSpec,
	}, kind.Kind)
	if err != nil {
		return err
	}
	kind.Schema = schema
	return nil
}

// clonePathProps copies props, so publishing the manifest's routes never
// changes the schema's, or the other way around.
func clonePathProps(props spec3.PathProps) (spec3.PathProps, error) {
	raw, err := json.Marshal(&spec3.Path{PathProps: props})
	if err != nil {
		return spec3.PathProps{}, err
	}
	var out spec3.Path
	if err := json.Unmarshal(raw, &out); err != nil {
		return spec3.PathProps{}, err
	}
	return out.PathProps, nil
}

func toMap(v any) (map[string]any, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	return out, json.Unmarshal(raw, &out)
}

func addMissingComponents[T any](dst *map[string]T, src map[string]T) {
	for name, v := range src {
		if _, ok := (*dst)[name]; ok {
			continue
		}
		if *dst == nil {
			*dst = map[string]T{}
		}
		(*dst)[name] = v
	}
}

// cloneComponents copies c's maps, so adding the schema's components to the
// settings manifest leaves its foundation's unchanged.
func cloneComponents(c app.ManifestVersionOpenAPIComponents) app.ManifestVersionOpenAPIComponents {
	return app.ManifestVersionOpenAPIComponents{
		Schemas:   maps.Clone(c.Schemas),
		Responses: maps.Clone(c.Responses),
		Examples:  maps.Clone(c.Examples),
	}
}
