package generic_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/generic"
)

var testGR = schema.GroupResource{Group: "articles.example.test", Resource: "articles"}

func testKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Group: testGR.Group, Resource: testGR.Resource, Namespace: "tenant", Name: "from-key"}
}

func testBuilder(fields ...app.ManifestVersionKindEmbedField) *generic.Builder {
	return generic.New(testGR, app.ManifestResourceEmbed{ReembedVersion: 7}, map[string][]app.ManifestVersionKindEmbedField{"v1": fields}, nil)
}

func testValue(t *testing.T, apiVersion string, spec any) []byte {
	t.Helper()
	value, err := json.Marshal(map[string]any{
		"apiVersion": apiVersion,
		"metadata": map[string]any{
			"name": "not-the-storage-name", "uid": "not-the-storage-uid",
			"annotations": map[string]string{"grafana.app/folder": "folder-1"},
		},
		"spec": spec,
	})
	require.NoError(t, err)
	return value
}

func TestBuilderExtract(t *testing.T) {
	b := testBuilder(
		app.ManifestVersionKindEmbedField{Name: "summary", Path: "spec.details.summary"},
		app.ManifestVersionKindEmbedField{Name: "section (text)", Path: "spec.tags"},
		app.ManifestVersionKindEmbedField{Name: "section (text)", Path: "spec.members[*].name"},
	)
	value := testValue(t, testGR.Group+"/v1", map[string]any{
		"title":   "Display title",
		"details": map[string]any{"summary": "  Useful summary\n"},
		"tags":    []any{nil, " alpha ", "", "beta"},
		"members": []any{
			map[string]any{"name": " first "}, map[string]any{}, nil,
			map[string]any{"name": nil}, map[string]any{"name": "last"},
		},
	})
	items, err := b.Extract(context.Background(), testKey(), value, "Do not add this folder title")
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, embed.Item{
		UID: "from-key", Title: "Display title", Folder: "folder-1",
		Content: "summary: Useful summary\nsection (text): alpha, beta\nsection (text): first, last",
	}, items[0])
	assert.Equal(t, testGR.Group, b.Group())
	assert.Equal(t, testGR.Resource, b.Resource())
	assert.Equal(t, 1, b.MaxItemsPerResource())
	assert.Equal(t, 7, b.Version())
}

func TestBuilderExactVersionsAndConstructorCopies(t *testing.T) {
	fields := map[string][]app.ManifestVersionKindEmbedField{
		"v1": {{Name: "body", Path: "spec.old"}},
		"v2": {{Name: "body", Path: "spec.current"}},
	}
	b := generic.New(testGR, app.ManifestResourceEmbed{ReembedVersion: 9}, fields, nil)
	fields["v1"][0].Path = "spec.changed"
	delete(fields, "v2")
	fields["v3"] = []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.changed"}}
	for _, version := range []string{"v1", "v2"} {
		t.Run(version, func(t *testing.T) {
			value := testValue(t, testGR.Group+"/"+version, map[string]any{"old": "v1", "current": "v2", "changed": "wrong"})
			items, err := b.Extract(context.Background(), testKey(), value, "")
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.Equal(t, "body: "+version, items[0].Content)
			assert.Equal(t, "from-key", items[0].UID)
			assert.Empty(t, items[0].Subresource)
			assert.Equal(t, 9, b.Version())
		})
	}
	_, err := b.Extract(context.Background(), testKey(), testValue(t, testGR.Group+"/v3", map[string]any{"changed": "wrong"}), "")
	require.ErrorIs(t, err, embed.ErrSkip)
}

func TestBuilderProjectedStringArrays(t *testing.T) {
	b := testBuilder(
		app.ManifestVersionKindEmbedField{Name: "members", Path: "spec.groups[*].members[*].name"},
		app.ManifestVersionKindEmbedField{Name: "tags", Path: "spec.groups[*].tags"},
		app.ManifestVersionKindEmbedField{Name: "matrix", Path: "spec.matrix[*]"},
	)
	value := testValue(t, testGR.Group+"/v1", map[string]any{
		"groups": []any{
			map[string]any{"members": []any{map[string]any{"name": "alice"}, nil}, "tags": []any{"a", nil, "b"}},
			nil,
			map[string]any{"members": []any{map[string]any{"name": "bob"}}, "tags": []any{"c"}},
		},
		"matrix": []any{[]any{"first", "second"}, nil, []any{"third"}},
	})
	items, err := b.Extract(t.Context(), testKey(), value, "")
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "members: alice, bob\ntags: a, b, c\nmatrix: first, second, third", items[0].Content)
}

func TestBuilderOmitsMalformedFields(t *testing.T) {
	for _, tc := range []struct {
		name string
		path string
		bad  any
	}{
		{"number", "spec.bad", 12},
		{"boolean", "spec.bad", true},
		{"object", "spec.bad", map[string]any{"text": "wrong"}},
		{"mixed array", "spec.bad", []any{"do not keep a partial field", 12}},
		{"nested array", "spec.bad", []any{[]any{"wrong"}}},
		{"non-array projection", "spec.bad[*].text", "wrong"},
		{"non-object parent", "spec.bad.text", 12},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := testBuilder(app.ManifestVersionKindEmbedField{Name: "bad", Path: tc.path}, app.ManifestVersionKindEmbedField{Name: "good", Path: "spec.good"})
			items, err := b.Extract(context.Background(), testKey(), testValue(t, testGR.Group+"/v1", map[string]any{"bad": tc.bad, "good": "kept"}), "")
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.Equal(t, "good: kept", items[0].Content)
		})
	}
}

func TestBuilderEmptyContent(t *testing.T) {
	for _, tc := range []struct {
		name   string
		fields []app.ManifestVersionKindEmbedField
		spec   any
	}{
		{"no fields", nil, map[string]any{"title": "Display title alone is not content"}},
		{"missing field", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}, map[string]any{}},
		{"null parent", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.details.body"}}, map[string]any{"details": nil}},
		{"null projection", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.members[*].text"}}, map[string]any{"members": nil}},
		{"blank scalar", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}, map[string]any{"body": " \n\t "}},
		{"empty array", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}, map[string]any{"body": []any{}}},
		{"blank array", []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}, map[string]any{"body": []any{nil, "", " \n "}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			items, err := testBuilder(tc.fields...).Extract(context.Background(), testKey(), testValue(t, testGR.Group+"/v1", tc.spec), "Folder title alone is not content")
			require.NoError(t, err)
			assert.Nil(t, items)
		})
	}
}

func TestBuilderSkipVersions(t *testing.T) {
	for _, tc := range []struct {
		name, value, label string
	}{
		{"undeclared", `{"apiVersion":"articles.example.test/v99"}`, "v99"},
		{"missing", `{}`, "<missing>"},
		{"empty", `{"apiVersion":""}`, "<missing>"},
		{"malformed", `{"apiVersion":"articles.example.test/v1/extra"}`, "<invalid>"},
		{"wrong type", `{"apiVersion":42}`, "<invalid>"},
		{"foreign group", `{"apiVersion":"other.example.test/v1"}`, "<unsupported>"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			skipped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "test_generic_skipped_versions_total", Help: "Skipped versions."}, []string{"group", "resource", "version"})
			b := generic.New(testGR, app.ManifestResourceEmbed{ReembedVersion: 1}, map[string][]app.ManifestVersionKindEmbedField{"v1": nil}, skipped)
			items, err := b.Extract(context.Background(), testKey(), []byte(tc.value), "")
			require.ErrorIs(t, err, embed.ErrSkip)
			assert.Empty(t, items)
			assert.Equal(t, 1.0, testutil.ToFloat64(skipped.WithLabelValues(testGR.Group, testGR.Resource, tc.label)))
		})
	}
}

func TestBuilderDisplayTitle(t *testing.T) {
	for _, tc := range []struct {
		name  string
		title any
		want  string
	}{
		{"title", "Article title", "Article title"},
		{"name fallback", "", "Article name"},
		{"non-string title", 42, "Article name"},
		{"key fallback", nil, "from-key"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			spec := map[string]any{"body": "text", "title": tc.title}
			if tc.title != nil {
				spec["name"] = "Article name"
			}
			items, err := testBuilder(app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"}).Extract(context.Background(), testKey(), testValue(t, testGR.Group+"/v1", spec), "")
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.Equal(t, tc.want, items[0].Title)
			assert.Equal(t, "body: text", items[0].Content)
		})
	}
}

func TestBuilderErrors(t *testing.T) {
	b := testBuilder(app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})
	valid := testValue(t, testGR.Group+"/v1", map[string]any{"body": "text"})
	for _, tc := range []struct {
		name  string
		key   *resourcepb.ResourceKey
		value []byte
	}{
		{"invalid JSON", testKey(), []byte(`{not json`)},
		{"nil key", nil, valid},
		{"wrong group", &resourcepb.ResourceKey{Group: "other.example.test", Resource: testGR.Resource, Name: "name"}, valid},
		{"wrong resource", &resourcepb.ResourceKey{Group: testGR.Group, Resource: "other", Name: "name"}, valid},
	} {
		t.Run(tc.name, func(t *testing.T) {
			items, err := b.Extract(context.Background(), tc.key, tc.value, "")
			require.Error(t, err)
			assert.NotErrorIs(t, err, embed.ErrSkip)
			assert.Empty(t, items)
		})
	}
}

func TestBuilderContentLimit(t *testing.T) {
	for _, tc := range []struct{ name, body, want string }{
		{"short", "é short", "body: é short"},
		{"exact limit", strings.Repeat("a", 4090), "body: " + strings.Repeat("a", 4090)},
		{"rune crosses limit", strings.Repeat("a", 4088) + "🌟suffix", "body: " + strings.Repeat("a", 4088)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			items, err := testBuilder(app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"}).Extract(context.Background(), testKey(), testValue(t, testGR.Group+"/v1", map[string]any{"body": tc.body}), "")
			require.NoError(t, err)
			require.Len(t, items, 1)
			assert.Equal(t, tc.want, items[0].Content)
			assert.LessOrEqual(t, len(items[0].Content), 4*1024)
			assert.True(t, utf8.ValidString(items[0].Content))
		})
	}
}
