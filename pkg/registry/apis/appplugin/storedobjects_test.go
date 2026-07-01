package appplugin

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	openapispec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/plugins"
)

func newParseTestBuilder(items ...pluginschema.StoredObject) *AppPluginAPIBuilder {
	b := &AppPluginAPIBuilder{
		pluginJSON:   plugins.JSONData{ID: "my-app"},
		groupVersion: schema.GroupVersion{Group: "my-app", Version: "v0alpha1"},
	}
	if len(items) > 0 {
		b.schemas = map[string]*pluginschema.PluginSchema{
			"v0alpha1": {
				TargetAPIVersion: "v0alpha1",
				StoredObjects:    &pluginschema.StoredObjectList{Items: items},
			},
		}
	}
	return b
}

func objectSchema() *openapispec.Schema {
	return &openapispec.Schema{SchemaProps: openapispec.SchemaProps{Type: []string{"object"}}}
}

func TestParseStoredObjects(t *testing.T) {
	t.Run("no schemas declared returns nil", func(t *testing.T) {
		kinds, err := newParseTestBuilder().parseStoredObjects()
		require.NoError(t, err)
		require.Nil(t, kinds)
	})

	t.Run("without status", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:     "Watchlist",
			Plural:   "watchlists",
			Singular: "watchlist",
			Spec:     objectSchema(),
		})
		kinds, err := b.parseStoredObjects()
		require.NoError(t, err)
		require.Len(t, kinds, 1)
		require.Equal(t, "Watchlist", kinds[0].Kind)
		require.Equal(t, "watchlists", kinds[0].Plural)
		require.Equal(t, "watchlist", kinds[0].Singular)
		require.False(t, kinds[0].Cluster)
		require.NotNil(t, kinds[0].Spec)
		require.False(t, kinds[0].HasStatus())
	})

	t.Run("with status", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:     "Watchlist",
			Plural:   "watchlists",
			Singular: "watchlist",
			Scope:    pluginschema.ScopeCluster,
			Spec:     objectSchema(),
			Status:   objectSchema(),
		})
		kinds, err := b.parseStoredObjects()
		require.NoError(t, err)
		require.Len(t, kinds, 1)
		require.True(t, kinds[0].Cluster)
		require.True(t, kinds[0].HasStatus())
		require.NotNil(t, kinds[0].Status)
	})

	t.Run("missing plural is an error", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:     "Watchlist",
			Singular: "watchlist",
			Spec:     objectSchema(),
		})
		_, err := b.parseStoredObjects()
		require.Error(t, err)
		require.Contains(t, err.Error(), "my-app")
		require.Contains(t, err.Error(), "Watchlist")
		require.Contains(t, err.Error(), "SDK tooling")
	})

	t.Run("missing singular is an error", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:   "Watchlist",
			Plural: "watchlists",
			Spec:   objectSchema(),
		})
		_, err := b.parseStoredObjects()
		require.Error(t, err)
		require.Contains(t, err.Error(), "Watchlist")
	})

	t.Run("missing name is an error", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Plural:   "watchlists",
			Singular: "watchlist",
			Spec:     objectSchema(),
		})
		_, err := b.parseStoredObjects()
		require.Error(t, err)
		require.Contains(t, err.Error(), "my-app")
	})
}

func TestAddStoredObjectComponentSchemas(t *testing.T) {
	t.Run("publishes per-kind schema with spec and status", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:     "Watchlist",
			Plural:   "watchlists",
			Singular: "watchlist",
			Spec: &openapispec.Schema{SchemaProps: openapispec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]openapispec.Schema{
					"title": *openapispec.StringProperty(),
				},
			}},
			Status: &openapispec.Schema{SchemaProps: openapispec.SchemaProps{
				Type: []string{"object"},
				Properties: map[string]openapispec.Schema{
					"state": *openapispec.StringProperty(),
				},
			}},
		})
		oas := &spec3.OpenAPI{}
		require.NoError(t, b.addStoredObjectComponentSchemas(oas))

		s, ok := oas.Components.Schemas["my-app/v0alpha1/Watchlist"]
		require.True(t, ok)
		require.Contains(t, s.Properties, "apiVersion")
		require.Contains(t, s.Properties, "kind")
		require.Contains(t, s.Properties, "metadata")
		require.Contains(t, s.Properties["spec"].Properties, "title")
		require.Contains(t, s.Properties["status"].Properties, "state")
	})

	t.Run("omits status property when not declared", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{
			Name:     "Watchlist",
			Plural:   "watchlists",
			Singular: "watchlist",
			Spec:     objectSchema(),
		})
		oas := &spec3.OpenAPI{}
		require.NoError(t, b.addStoredObjectComponentSchemas(oas))

		s := oas.Components.Schemas["my-app/v0alpha1/Watchlist"]
		require.NotNil(t, s)
		require.NotContains(t, s.Properties, "status")
	})

	t.Run("parse error is propagated", func(t *testing.T) {
		b := newParseTestBuilder(pluginschema.StoredObject{Name: "Watchlist", Spec: objectSchema()})
		require.Error(t, b.addStoredObjectComponentSchemas(&spec3.OpenAPI{}))
	})
}
