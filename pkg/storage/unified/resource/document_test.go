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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
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
		builder := StandardDocumentBuilderWithFields(nil, provider)
		doc, err := builder.BuildDocument(ctx, key, 1, bodyNoVersion)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})

	t.Run("nil provider preserves legacy behaviour", func(t *testing.T) {
		// Constructor without a provider must produce the same shape as
		// StandardDocumentBuilder(manifests).
		builder := StandardDocumentBuilderWithFields(nil, nil)
		doc, err := builder.BuildDocument(ctx, key, 1, body)
		require.NoError(t, err)
		assert.Empty(t, doc.Fields)
	})
}
