package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStandardDocumentBuilder(t *testing.T) {
	ctx := context.Background()
	builder := StandardDocumentBuilder(nil)

	body, err := os.ReadFile("testdata/playlist-resource.json")
	require.NoError(t, err)
	doc, err := builder.BuildDocument(ctx, &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "playlists.grafana.app",
		Resource:  "playlists",
		Name:      "test1",
	}, 10, body)
	require.NoError(t, err)

	jj, _ := json.MarshalIndent(doc, "", "  ")
	fmt.Printf("%s\n", string(jj))
	require.JSONEq(t, `{
		"key": {
			"namespace": "default",
			"group": "playlists.grafana.app",
			"resource": "playlists",
			"name": "test1"
		},
		"name": "test1",
		"rv": 10,
		"title": "Test Playlist from Unified Storage",
		"title_ngram": "Test Playlist from Unified Storage",
		"title_phrase": "test playlist from unified storage",
		"description": "description for the test playlist",
		"created": 1717236672000,
		"createdBy": "user:ABC",
		"updatedBy": "user:XYZ",
		"manager": {
			"kind": "repo",
			"id": "something"
		},
		"managedBy": "repo:something",
		"ownerReferences": [
			"iam.grafana.app/Team/engineering",
			"iam.grafana.app/User/test"
		],
		"source": {
			"path": "path/in/system.json",
			"checksum": "xyz"
		}
	}`, string(jj))
}

// registryWithProvider seeds a registry so the standard builder finds the given
// provider for the kind under test.
func registryWithProvider(gvr schema.GroupVersionResource, provider SearchFieldsProvider) *SearchFieldsRegistry {
	return NewSearchFieldsRegistry(nil, nil, map[LowerGroupResource]SearchFieldsProvider{
		NewLowerGroupResource(gvr.Group, gvr.Resource): provider,
	})
}

func TestStandardDocumentBuilder_DeclaredFields(t *testing.T) {
	ctx := t.Context()
	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     gvr.Group,
		Resource:  gvr.Resource,
		Name:      "thing-1",
	}
	// One members entry deliberately omits the "name" sub-field. The
	// extractor must skip that entry rather than dropping the whole
	// member_names field for the document.
	body := []byte(`{
		"apiVersion": "example.grafana.app/v1",
		"kind": "Thing",
		"metadata": {"name": "thing-1", "namespace": "default"},
		"spec": {
			"email": "alice@example.com",
			"size": 42,
			"members": [
				{"name": "alice"},
				{"role": "viewer"},
				{"name": "bob"}
			]
		}
	}`)

	t.Run("extracts declared paths", func(t *testing.T) {
		provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			gvr: {
				{Name: "email", Path: "spec.email", Type: SearchFieldTypeString},
				{Name: "size", Path: "spec.size", Type: SearchFieldTypeInt64},
				{Name: "member_names", Path: "spec.members[*].name", Type: SearchFieldTypeString, Array: true},
			},
		}, nil)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		require.Equal(t, "alice@example.com", doc.Fields["email"])
		require.Equal(t, int64(42), doc.Fields["size"])
		// The middle member has no "name" sub-field, so it is skipped
		// without losing the names that did resolve.
		require.Equal(t, []any{"alice", "bob"}, doc.Fields["member_names"])
	})

	t.Run("path-less definitions are ignored", func(t *testing.T) {
		provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			gvr: {
				{Name: "computed", Type: SearchFieldTypeString},
			},
		}, nil)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		_, present := doc.Fields["computed"]
		assert.False(t, present)
	})

	t.Run("type mismatch drops the field without error", func(t *testing.T) {
		provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			gvr: {
				{Name: "email", Path: "spec.email", Type: SearchFieldTypeInt64},
			},
		}, nil)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		_, present := doc.Fields["email"]
		assert.False(t, present, "type mismatch should drop the field rather than fail the build")
	})

	t.Run("missing path is silently skipped", func(t *testing.T) {
		provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			gvr: {
				{Name: "absent", Path: "spec.not_there", Type: SearchFieldTypeString},
			},
		}, nil)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})

	t.Run("strict version match: no extraction when manifest does not cover the doc's apiVersion", func(t *testing.T) {
		// Provider has fields under v2 only; doc carries apiVersion v1.
		// Manifest authors are responsible for declaring every served
		// version, so the builder does not silently fall back across
		// versions.
		v2 := schema.GroupVersionResource{Group: gvr.Group, Version: "v2", Resource: gvr.Resource}
		provider := NewMapProvider(
			map[schema.GroupVersionResource][]SearchFieldDefinition{
				v2: {{Name: "email", Path: "spec.email", Type: SearchFieldTypeString}},
			},
			map[schema.GroupResource]string{
				{Group: gvr.Group, Resource: gvr.Resource}: "v2",
			},
		)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})

	t.Run("missing apiVersion falls back to PreferredVersion", func(t *testing.T) {
		// Body intentionally has no apiVersion; the only sane guess at the
		// version is the manifest's preferred served version.
		bodyNoVersion := []byte(`{
			"kind": "Thing",
			"metadata": {"name": "thing-1", "namespace": "default"},
			"spec": {"email": "alice@example.com"}
		}`)
		provider := NewMapProvider(
			map[schema.GroupVersionResource][]SearchFieldDefinition{
				gvr: {{Name: "email", Path: "spec.email", Type: SearchFieldTypeString}},
			},
			map[schema.GroupResource]string{
				{Group: gvr.Group, Resource: gvr.Resource}: gvr.Version,
			},
		)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, bodyNoVersion)
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", doc.Fields["email"])
	})

	t.Run("EmitZeroIfAbsent emits the type's zero value when path is missing", func(t *testing.T) {
		// Body has none of the declared fields populated. Each one is set
		// to its zero value so sort and range queries treat every document
		// as having the field present.
		bodyEmpty := []byte(`{
			"apiVersion": "example.grafana.app/v1",
			"kind": "Thing",
			"metadata": {"name": "thing-1", "namespace": "default"},
			"spec": {}
		}`)
		provider := NewMapProvider(
			map[schema.GroupVersionResource][]SearchFieldDefinition{
				gvr: {
					{Name: "flag", Path: "spec.flag", Type: SearchFieldTypeBoolean, EmitZeroIfAbsent: true},
					{Name: "count", Path: "spec.count", Type: SearchFieldTypeInt64, EmitZeroIfAbsent: true},
					{Name: "ratio", Path: "spec.ratio", Type: SearchFieldTypeDouble, EmitZeroIfAbsent: true},
					{Name: "label", Path: "spec.label", Type: SearchFieldTypeString, EmitZeroIfAbsent: true},
					{Name: "tags", Path: "spec.tags", Type: SearchFieldTypeString, Array: true, EmitZeroIfAbsent: true},
					// Without the flag, an absent field stays absent.
					{Name: "silent", Path: "spec.silent", Type: SearchFieldTypeString},
				},
			}, nil,
		)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, bodyEmpty)
		require.NoError(t, err)
		assert.Equal(t, false, doc.Fields["flag"])
		assert.Equal(t, int64(0), doc.Fields["count"])
		assert.Equal(t, float64(0), doc.Fields["ratio"])
		assert.Equal(t, "", doc.Fields["label"])
		assert.Equal(t, []any{}, doc.Fields["tags"])
		_, hasSilent := doc.Fields["silent"]
		assert.False(t, hasSilent, "field without EmitZeroIfAbsent must stay absent")
	})

	t.Run("missing apiVersion and no PreferredVersion: no extraction", func(t *testing.T) {
		bodyNoVersion := []byte(`{
			"kind": "Thing",
			"metadata": {"name": "thing-1", "namespace": "default"},
			"spec": {"email": "alice@example.com"}
		}`)
		provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{
			gvr: {{Name: "email", Path: "spec.email", Type: SearchFieldTypeString}},
		}, nil)
		builder := StandardDocumentBuilder(registryWithProvider(gvr, provider))
		doc, err := builder.BuildDocument(ctx, key, 1, bodyNoVersion)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})

	t.Run("nil registry preserves base behaviour", func(t *testing.T) {
		// Without a registry the builder still produces the base document,
		// just no selectable or declared fields.
		builder := StandardDocumentBuilder(nil)
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})
}

// TestStandardDocumentBuilder_ReloadThroughRegistry verifies the central
// reload behavior: one builder, backed by a registry, reflects a Replace of the
// registry's selectable fields and path-based definitions on the next document
// without being rebuilt.
func TestStandardDocumentBuilder_ReloadThroughRegistry(t *testing.T) {
	ctx := t.Context()
	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
	gr := gvr.GroupResource()
	sfKey := NewLowerGroupResource(gvr.Group, gvr.Resource)
	key := &resourcepb.ResourceKey{Namespace: "default", Group: gvr.Group, Resource: gvr.Resource, Name: "thing-1"}
	body := []byte(`{
		"apiVersion": "example.grafana.app/v1",
		"kind": "Thing",
		"metadata": {"name": "thing-1"},
		"spec": {"a": "AAA", "b": "BBB", "x": "XXX", "y": "YYY"}
	}`)

	providerFor := func(name, path string) SearchFieldsProvider {
		return NewMapProvider(
			map[schema.GroupVersionResource][]SearchFieldDefinition{
				gvr: {{Name: name, Path: path, Type: SearchFieldTypeString}},
			},
			map[schema.GroupResource]string{gr: gvr.Version},
		)
	}

	registry := NewSearchFieldsRegistry(
		map[LowerGroupResource][]string{sfKey: {"spec.x"}},
		nil,
		map[LowerGroupResource]SearchFieldsProvider{sfKey: providerFor("a", "spec.a")},
	)
	builder := StandardDocumentBuilder(registry)

	doc, err := builder.BuildDocument(ctx, key, 1, body)
	require.NoError(t, err)
	require.Equal(t, "AAA", doc.Fields["a"])
	require.NotContains(t, doc.Fields, "b")
	require.Contains(t, doc.SelectableFields, "spec.x")
	require.NotContains(t, doc.SelectableFields, "spec.y")

	// Reload with different declared and selectable fields; the same builder
	// must reflect them on the next document.
	registry.Replace(
		map[LowerGroupResource][]string{sfKey: {"spec.y"}},
		nil,
		map[LowerGroupResource]SearchFieldsProvider{sfKey: providerFor("b", "spec.b")},
	)

	doc, err = builder.BuildDocument(ctx, key, 1, body)
	require.NoError(t, err)
	require.Equal(t, "BBB", doc.Fields["b"])
	require.NotContains(t, doc.Fields, "a")
	require.Contains(t, doc.SelectableFields, "spec.y")
	require.NotContains(t, doc.SelectableFields, "spec.x")
}

// Tags and description come from the spec via the standard builder, so a kind gets
// them without registering its own document builder. Before this, doc.Tags and
// doc.Description were only ever set by the dashboard builder, and every other kind
// indexed without them — both fields were declared and mapped, but never populated.
func TestStandardDocumentBuilder_SpecFields(t *testing.T) {
	ctx := context.Background()
	builder := StandardDocumentBuilder(nil)

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "notebooks",
		Name:      "nb1",
	}

	build := func(t *testing.T, spec string) *IndexableDocument {
		t.Helper()
		body := []byte(`{
			"apiVersion": "dashboard.grafana.app/v2beta1",
			"kind": "Notebook",
			"metadata": {"name": "nb1"},
			"spec": ` + spec + `
		}`)
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		return doc
	}

	t.Run("reads spec.tags", func(t *testing.T) {
		doc := build(t, `{"title": "Checkout latency", "tags": ["incident", "checkout"]}`)
		assert.Equal(t, []string{"incident", "checkout"}, doc.Tags)
	})

	t.Run("leaves tags unset when there are none", func(t *testing.T) {
		assert.Nil(t, build(t, `{"title": "No tags"}`).Tags, "absent")
		assert.Nil(t, build(t, `{"title": "Empty", "tags": []}`).Tags, "empty list")
	})

	// One malformed entry should not cost the resource its place in the index, nor
	// the tags around it.
	t.Run("skips entries that are not usable strings", func(t *testing.T) {
		doc := build(t, `{"title": "Mixed", "tags": ["good", 42, null, "", "also-good"]}`)
		assert.Equal(t, []string{"good", "also-good"}, doc.Tags)
	})

	t.Run("ignores a tags value that is not a list", func(t *testing.T) {
		assert.Nil(t, build(t, `{"title": "Wrong shape", "tags": "incident"}`).Tags)
	})

	t.Run("reads spec.description", func(t *testing.T) {
		doc := build(t, `{"title": "Checkout latency", "description": "Why checkout got slow"}`)
		assert.Equal(t, "Why checkout got slow", doc.Description)
	})

	t.Run("leaves description empty when there is none", func(t *testing.T) {
		assert.Empty(t, build(t, `{"title": "No description"}`).Description, "absent")
		assert.Empty(t, build(t, `{"title": "Blank", "description": ""}`).Description, "empty string")
	})

	t.Run("ignores a description that is not a string", func(t *testing.T) {
		assert.Empty(t, build(t, `{"title": "Wrong shape", "description": {"nested": true}}`).Description)
	})

	// The two are read from the same spec lookup, so a kind declaring both gets both.
	t.Run("reads tags and description together", func(t *testing.T) {
		doc := build(t, `{"title": "Both", "tags": ["incident"], "description": "Has both"}`)
		assert.Equal(t, []string{"incident"}, doc.Tags)
		assert.Equal(t, "Has both", doc.Description)
	})

	// The spec lookup must not displace what the constructor already resolves.
	t.Run("still populates the standard fields", func(t *testing.T) {
		doc := build(t, `{"title": "Checkout latency", "tags": ["incident"], "description": "d"}`)
		assert.Equal(t, "Checkout latency", doc.Title)
		assert.Equal(t, "nb1", doc.Name)
	})
}
