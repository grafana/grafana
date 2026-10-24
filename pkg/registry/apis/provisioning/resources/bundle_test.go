package resources

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

const testManifest = "bundles/sample/bundle.yaml"

func bundleObj(paths any) *unstructured.Unstructured {
	spec := map[string]any{}
	if paths != nil {
		spec["paths"] = paths
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Bundle",
		"metadata":   map[string]any{"name": "sample"},
		"spec":       spec,
	}}
}

func TestParseBundleEntries(t *testing.T) {
	tests := []struct {
		name    string
		obj     *unstructured.Unstructured
		want    []string
		wantErr error
	}{
		{name: "nil object", obj: nil},
		{name: "no paths", obj: bundleObj(nil)},
		{name: "empty list", obj: bundleObj([]any{}), want: []string{}},
		{
			name: "files and folders",
			obj: bundleObj([]any{
				"bundles/sample/README.md",
				"bundles/sample/docs/",
				"shared/query.sql",
			}),
			want: []string{
				"bundles/sample/README.md",
				"bundles/sample/docs/",
				"shared/query.sql",
			},
		},
		{
			name: "declaration order is preserved",
			obj:  bundleObj([]any{"bundles/sample/z.md", "bundles/sample/a.md"}),
			want: []string{"bundles/sample/z.md", "bundles/sample/a.md"},
		},
		{
			name: "extensions the resource pipeline cannot parse are allowed",
			obj:  bundleObj([]any{"bundles/sample/run.sh", "bundles/sample/data.csv"}),
			want: []string{"bundles/sample/run.sh", "bundles/sample/data.csv"},
		},
		{
			name: "surrounding whitespace is trimmed",
			obj:  bundleObj([]any{"  bundles/sample/notes.md  "}),
			want: []string{"bundles/sample/notes.md"},
		},
		{name: "paths is not a list", obj: bundleObj("a.md"), wantErr: ErrBundlePathsType},
		{name: "entry is not a string", obj: bundleObj([]any{"a.md", 42}), wantErr: ErrBundlePathsType},
		{name: "empty entry", obj: bundleObj([]any{"   "}), wantErr: ErrBundleEntryEmpty},
		{name: "root entry", obj: bundleObj([]any{"/"}), wantErr: ErrBundleEntryEmpty},
		{
			name:    "duplicate entry",
			obj:     bundleObj([]any{"a.md", " a.md"}),
			wantErr: ErrBundleEntryDuplicate,
		},
		{
			name:    "traversal is rejected",
			obj:     bundleObj([]any{"bundles/sample/../../etc/passwd"}),
			wantErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name:    "traversal in a folder entry is rejected",
			obj:     bundleObj([]any{"bundles/sample/../../etc/"}),
			wantErr: safepath.ErrPathTraversalAttempt,
		},
		{name: "absolute path is rejected", obj: bundleObj([]any{"/etc/passwd"}), wantErr: ErrNotRelative},
		{
			name:    "hidden path is rejected",
			obj:     bundleObj([]any{"bundles/.secret/notes.md"}),
			wantErr: safepath.ErrHiddenPath,
		},
		{
			name:    "path that is too deep is rejected",
			obj:     bundleObj([]any{"a/b/c/d/e/f/g/h/i/too-deep.md"}),
			wantErr: ErrPathTooDeep,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseBundleEntries(tt.obj)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)

			paths := make([]string, 0, len(got))
			for _, entry := range got {
				paths = append(paths, entry.Path)
			}
			if tt.want == nil {
				assert.Empty(t, paths)
				return
			}
			assert.Equal(t, tt.want, paths)
		})
	}
}

func TestParseBundleRef_TooLong(t *testing.T) {
	// The reference is carried as a label value, and those may not exceed 63 characters.
	withLabel := func(value string) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"labels": map[string]any{provisioning.BundleLabel: value},
			},
		}}
	}

	_, err := ParseBundleRef(withLabel(strings.Repeat("b", 64)))
	require.ErrorIs(t, err, ErrBundleRefTooLong)

	_, err = ParseBundleRef(withLabel(strings.Repeat("b", 63)))
	require.NoError(t, err)
}

func TestParseBundleEntries_TooManyEntries(t *testing.T) {
	values := make([]any, BundleMaxEntries+1)
	for i := range values {
		values[i] = fmt.Sprintf("bundles/sample/f%d.md", i)
	}

	_, err := ParseBundleEntries(bundleObj(values))
	require.ErrorIs(t, err, ErrBundleTooManyEntries)

	_, err = ParseBundleEntries(bundleObj(values[:BundleMaxEntries]))
	require.NoError(t, err)
}

func TestParseBundleEntries_ErrorNamesOffendingPath(t *testing.T) {
	_, err := ParseBundleEntries(bundleObj([]any{"ok.md", "/etc/passwd"}))

	var entryErr *BundleEntryError
	require.ErrorAs(t, err, &entryErr)
	assert.Equal(t, "/etc/passwd", entryErr.Path)
}

func TestBundleEntryIsFolder(t *testing.T) {
	// The trailing separator is the folder marker, the same convention the rest of
	// provisioning uses.
	assert.True(t, BundleEntry{Path: "bundles/sample/docs/"}.IsFolder())
	assert.False(t, BundleEntry{Path: "bundles/sample/docs"}.IsFolder())
	assert.False(t, BundleEntry{Path: "bundles/sample/a.md"}.IsFolder())
}

func TestParseBundleRef(t *testing.T) {
	ref := func(labels map[string]any) *unstructured.Unstructured {
		meta := map[string]any{"name": "sample"}
		if labels != nil {
			meta["labels"] = labels
		}
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "example.grafana.app/v0alpha1",
			"kind":       "SampleResource",
			"metadata":   meta,
			"spec":       map[string]any{"title": "a resource"},
		}}
	}

	t.Run("reads the bundle label", func(t *testing.T) {
		got, err := ParseBundleRef(ref(map[string]any{provisioning.BundleLabel: "sample"}))
		require.NoError(t, err)
		assert.Equal(t, "sample", got)
	})

	t.Run("trims whitespace", func(t *testing.T) {
		got, err := ParseBundleRef(ref(map[string]any{provisioning.BundleLabel: "  sample  "}))
		require.NoError(t, err)
		assert.Equal(t, "sample", got)
	})

	t.Run("no label is valid", func(t *testing.T) {
		got, err := ParseBundleRef(ref(nil))
		require.NoError(t, err)
		assert.Empty(t, got)
	})

	t.Run("other labels are ignored", func(t *testing.T) {
		got, err := ParseBundleRef(ref(map[string]any{"team": "sre"}))
		require.NoError(t, err)
		assert.Empty(t, got)
	})

	t.Run("nil object is valid", func(t *testing.T) {
		got, err := ParseBundleRef(nil)
		require.NoError(t, err)
		assert.Empty(t, got)
	})
}

func resolveFixture(t *testing.T, files []any, candidates []string, reserved ...string) BundleResolution {
	t.Helper()

	entries, err := ParseBundleEntries(bundleObj(files))
	require.NoError(t, err)

	resolution, err := ResolveBundleFiles(entries, candidates, ResolveOptions{
		Ref:          "abc123",
		ManifestPath: testManifest,
		Reserved:     sets.New(reserved...),
	})
	require.NoError(t, err)
	return resolution
}

func TestResolveBundleFiles(t *testing.T) {
	candidates := []string{
		testManifest,
		"bundles/sample/README.md",
		"bundles/sample/docs/a.md",
		"bundles/sample/docs/nested/b.md",
		"bundles/sample/scripts/run.sh",
		"bundles/other/bundle.yaml",
		"bundles/other/notes.md",
		"shared/query.sql",
	}

	t.Run("expands folders and records the ref", func(t *testing.T) {
		got := resolveFixture(t, []any{
			"bundles/sample/docs/",
			"shared/query.sql",
		}, candidates)

		assert.Equal(t, "abc123", got.Ref)
		assert.True(t, got.IsComplete())
		assert.Equal(t, []string{
			"bundles/sample/docs/a.md",
			"bundles/sample/docs/nested/b.md",
			"shared/query.sql",
		}, got.Files)
	})

	t.Run("a folder entry reaches any depth", func(t *testing.T) {
		got := resolveFixture(t, []any{"bundles/sample/"}, candidates)

		assert.Contains(t, got.Files, "bundles/sample/docs/nested/b.md")
		assert.Contains(t, got.Files, "bundles/sample/scripts/run.sh")
	})

	t.Run("never claims the manifest", func(t *testing.T) {
		got := resolveFixture(t, []any{"bundles/sample/"}, candidates)

		assert.NotContains(t, got.Files, testManifest)
		assert.Contains(t, got.Files, "bundles/sample/README.md")
	})

	t.Run("never claims a reserved path", func(t *testing.T) {
		got := resolveFixture(t, []any{"bundles/"}, candidates, "bundles/other/bundle.yaml")

		assert.NotContains(t, got.Files, "bundles/other/bundle.yaml")
		assert.Contains(t, got.Files, "bundles/other/notes.md")
	})

	t.Run("an overlapping path is counted once", func(t *testing.T) {
		got := resolveFixture(t, []any{
			"bundles/sample/docs/a.md",
			"bundles/sample/docs/",
		}, candidates)

		assert.Equal(t, []string{
			"bundles/sample/docs/a.md",
			"bundles/sample/docs/nested/b.md",
		}, got.Files)
	})

	t.Run("a path that resolves to nothing is reported, not hidden", func(t *testing.T) {
		got := resolveFixture(t, []any{
			"bundles/sample/moved-away/",
			"bundles/sample/README.md",
		}, candidates)

		assert.False(t, got.IsComplete())
		assert.Equal(t, []string{"bundles/sample/moved-away/"}, got.Unresolved)
		assert.Equal(t, []string{"bundles/sample/README.md"}, got.Files)
	})

	t.Run("unsafe candidates are skipped rather than failing the bundle", func(t *testing.T) {
		got := resolveFixture(t, []any{"bundles/sample/"},
			append([]string{"bundles/sample/.hidden/secret.md", "bundles/sample/ok.md"}, candidates...))

		assert.Contains(t, got.Files, "bundles/sample/ok.md")
		assert.NotContains(t, got.Files, "bundles/sample/.hidden/secret.md")
	})

	t.Run("no entries resolves to nothing", func(t *testing.T) {
		got := resolveFixture(t, nil, candidates)

		assert.Empty(t, got.Files)
		assert.True(t, got.IsComplete())
	})
}

func TestResolveBundleFiles_TooManyFiles(t *testing.T) {
	candidates := make([]string, BundleMaxFiles+1)
	for i := range candidates {
		candidates[i] = fmt.Sprintf("bundles/sample/f%03d.md", i)
	}

	entries, err := ParseBundleEntries(bundleObj([]any{"bundles/sample/"}))
	require.NoError(t, err)

	_, err = ResolveBundleFiles(entries, candidates, ResolveOptions{ManifestPath: testManifest})
	require.ErrorIs(t, err, ErrBundleTooManyFiles)

	_, err = ResolveBundleFiles(entries, candidates[:BundleMaxFiles], ResolveOptions{ManifestPath: testManifest})
	require.NoError(t, err)
}

func TestBundleIndex(t *testing.T) {
	t.Run("claims and releases paths", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"a/one.md", "shared/two.md"})

		assert.Equal(t, []string{"a/bundle.yaml"}, idx.Claimants("shared/two.md"))
		assert.True(t, idx.IsClaimed("a/one.md"))
		assert.False(t, idx.IsClaimed("a/unclaimed.md"))
		assert.Equal(t, []string{"a/one.md", "shared/two.md"}, idx.Paths())

		idx.Remove("a/bundle.yaml")
		assert.False(t, idx.IsClaimed("a/one.md"))
		assert.Empty(t, idx.Bundles())
	})

	t.Run("two bundles may declare the same path", func(t *testing.T) {
		// Not a conflict: each bundle stores its own copy, so there is nothing to
		// reference-count and deletion stays per bundle.
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"shared/two.md"})
		idx.Add("b/bundle.yaml", []string{"shared/two.md"})

		assert.Equal(t, []string{"a/bundle.yaml", "b/bundle.yaml"}, idx.Claimants("shared/two.md"))

		idx.Remove("a/bundle.yaml")
		assert.True(t, idx.IsClaimed("shared/two.md"), "b still declares it")
	})

	t.Run("re-adding the same bundle replaces its claims", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"a/one.md", "a/two.md"})
		idx.Add("a/bundle.yaml", []string{"a/two.md", "a/three.md"})

		assert.False(t, idx.IsClaimed("a/one.md"))
		assert.True(t, idx.IsClaimed("a/three.md"))
		assert.Equal(t, []string{"a/two.md", "a/three.md"}, idx.Files("a/bundle.yaml"))
	})

	t.Run("indexes a resolution", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.AddResolution("a/bundle.yaml", BundleResolution{Ref: "abc", Files: []string{"a/one.md"}})

		assert.True(t, idx.IsClaimed("a/one.md"))
	})

	t.Run("bundles are listed deterministically", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("z/bundle.yaml", nil)
		idx.Add("a/bundle.yaml", nil)
		idx.Add("m/bundle.yaml", nil)

		assert.Equal(t, []string{"a/bundle.yaml", "m/bundle.yaml", "z/bundle.yaml"}, idx.Bundles())
	})
}
