package resources

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

const testManifest = "bundles/sample/bundle.yaml"

func bundleObj(files any) *unstructured.Unstructured {
	obj := map[string]any{
		"apiVersion": "example.grafana.app/v0alpha1",
		"kind":       "SampleBundle",
		"metadata":   map[string]any{"name": "sample"},
		"spec":       map[string]any{"title": "a bundle"},
	}
	if files != nil {
		obj["files"] = files
	}
	return &unstructured.Unstructured{Object: obj}
}

func TestParseBundleSelectors(t *testing.T) {
	tests := []struct {
		name    string
		obj     *unstructured.Unstructured
		want    []BundleSelector
		wantErr error
	}{
		{
			name: "nil object",
			obj:  nil,
		},
		{
			name: "no files block",
			obj:  bundleObj(nil),
		},
		{
			name: "empty files block",
			obj:  bundleObj(map[string]any{}),
			want: []BundleSelector{},
		},
		{
			name: "exact path",
			obj: bundleObj(map[string]any{
				"query": map[string]any{"path": "shared/query.sql"},
			}),
			want: []BundleSelector{{Name: "query", Path: "shared/query.sql"}},
		},
		{
			name: "parts are returned in sorted name order",
			obj: bundleObj(map[string]any{
				"zeta":  map[string]any{"path": "bundles/sample/z.md"},
				"alpha": map[string]any{"path": "bundles/sample/a.md"},
			}),
			want: []BundleSelector{
				{Name: "alpha", Path: "bundles/sample/a.md"},
				{Name: "zeta", Path: "bundles/sample/z.md"},
			},
		},
		{
			name: "unknown name characters are rejected",
			obj: bundleObj(map[string]any{
				"Docs": map[string]any{"path": "bundles/sample/a.md"},
			}),
			wantErr: ErrBundleSelectorName,
		},
		{
			name: "neither path nor include",
			obj: bundleObj(map[string]any{
				"docs": map[string]any{"exclude": []any{"**/*.tmp"}},
			}),
			wantErr: ErrBundleSelectorEmpty,
		},
		{
			name: "both path and include",
			obj: bundleObj(map[string]any{
				"docs": map[string]any{"path": "a.md", "include": "b/**"},
			}),
			wantErr: ErrBundleSelectorAmbiguous,
		},
		{
			name: "unrooted pattern is rejected",
			obj: bundleObj(map[string]any{
				"everything": map[string]any{"include": "**/*.md"},
			}),
			wantErr: ErrBundleSelectorUnrooted,
		},
		{
			name: "pattern rooted at a traversal is rejected",
			obj: bundleObj(map[string]any{
				"escape": map[string]any{"include": "../../etc/**"},
			}),
			wantErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name: "manifest cannot claim itself",
			obj: bundleObj(map[string]any{
				"self": map[string]any{"path": testManifest},
			}),
			wantErr: ErrBundleFileIsManifest,
		},
		{
			name:    "files block is not a map",
			obj:     bundleObj([]any{"a.md"}),
			wantErr: ErrBundleFilesType,
		},
		{
			name: "selector is not a map",
			obj: bundleObj(map[string]any{
				"docs": "bundles/sample/a.md",
			}),
			wantErr: ErrBundleFilesType,
		},
		{
			name: "exclude must be strings",
			obj: bundleObj(map[string]any{
				"docs": map[string]any{"include": "bundles/sample/**", "exclude": []any{42}},
			}),
			wantErr: ErrBundleFilesType,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseBundleSelectors(tt.obj, testManifest)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Len(t, got, len(tt.want))
			for i := range tt.want {
				assert.Equal(t, tt.want[i].Name, got[i].Name)
				assert.Equal(t, tt.want[i].Path, got[i].Path)
				assert.Equal(t, tt.want[i].Include, got[i].Include)
			}
		})
	}
}

func TestParseBundleSelectors_TooManySelectors(t *testing.T) {
	files := map[string]any{}
	for i := range BundleMaxSelectors + 1 {
		files[fmt.Sprintf("part-%d", i)] = map[string]any{"path": fmt.Sprintf("bundles/sample/f%d.md", i)}
	}

	_, err := ParseBundleSelectors(bundleObj(files), testManifest)
	require.ErrorIs(t, err, ErrBundleTooManySelectors)
}

func TestPatternRoot(t *testing.T) {
	tests := map[string]string{
		"bundles/sample/**":        "bundles/sample",
		"bundles/sample/docs/*.md": "bundles/sample/docs",
		"bundles/sample/a.md":      "bundles/sample/a.md",
		"**/*.md":                  "",
		"*":                        "",
		"bundles/*/docs/**":        "bundles",
	}

	for pattern, want := range tests {
		t.Run(pattern, func(t *testing.T) {
			assert.Equal(t, want, patternRoot(pattern))
		})
	}
}

func resolveFixture(t *testing.T, files map[string]any, candidates []string, reserved ...string) BundleResolution {
	t.Helper()

	selectors, err := ParseBundleSelectors(bundleObj(files), testManifest)
	require.NoError(t, err)

	resolution, err := ResolveBundleFiles(selectors, candidates, ResolveOptions{
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
		"bundles/sample/docs/draft.tmp",
		"bundles/sample/scripts/run.sh",
		"bundles/other/bundle.yaml",
		"bundles/other/notes.md",
		"shared/query.sql",
	}

	t.Run("matches patterns and records the ref", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"docs": map[string]any{
				"include": "bundles/sample/docs/**",
				"exclude": []any{"**/*.tmp"},
			},
			"scripts": map[string]any{"include": "bundles/sample/scripts/**"},
			"query":   map[string]any{"path": "shared/query.sql"},
		}, candidates)

		assert.Equal(t, "abc123", got.Ref)
		assert.True(t, got.IsComplete())
		assert.Equal(t, []string{
			"bundles/sample/docs/a.md",
			"bundles/sample/docs/nested/b.md",
			"bundles/sample/scripts/run.sh",
			"shared/query.sql",
		}, got.Files)

		// Parts are in sorted-name order: docs, query, scripts.
		require.Len(t, got.Parts, 3)
		assert.Equal(t, "docs", got.Parts[0].Name)
		assert.Equal(t, []string{"bundles/sample/docs/a.md", "bundles/sample/docs/nested/b.md"}, got.Parts[0].Matched)
		assert.Equal(t, "query", got.Parts[1].Name)
		assert.Equal(t, []string{"shared/query.sql"}, got.Parts[1].Matched)
		assert.Equal(t, "scripts", got.Parts[2].Name)
	})

	t.Run("never matches the manifest", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"all": map[string]any{"include": "bundles/sample/**"},
		}, candidates)

		assert.NotContains(t, got.Files, testManifest)
		assert.Contains(t, got.Files, "bundles/sample/README.md")
	})

	t.Run("never matches a reserved path", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"wide": map[string]any{"include": "bundles/**"},
		}, candidates, "bundles/other/bundle.yaml")

		assert.NotContains(t, got.Files, "bundles/other/bundle.yaml")
		assert.Contains(t, got.Files, "bundles/other/notes.md")
	})

	t.Run("a single star does not cross a separator", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"docs": map[string]any{"include": "bundles/sample/docs/*.md"},
		}, candidates)

		assert.Equal(t, []string{"bundles/sample/docs/a.md"}, got.Files)
	})

	t.Run("an overlapping path is attributed to the first part by name", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"aaa": map[string]any{"include": "bundles/sample/docs/*.md"},
			"bbb": map[string]any{"include": "bundles/sample/docs/**"},
		}, candidates)

		assert.Equal(t, []string{"bundles/sample/docs/a.md"}, got.Parts[0].Matched)
		assert.NotContains(t, got.Parts[1].Matched, "bundles/sample/docs/a.md")
		// The path is still counted once overall.
		assert.Equal(t, []string{
			"bundles/sample/docs/a.md",
			"bundles/sample/docs/draft.tmp",
			"bundles/sample/docs/nested/b.md",
		}, got.Files)
	})

	t.Run("a part matching nothing is reported, not hidden", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"renamed": map[string]any{"include": "bundles/sample/moved-away/**"},
			"docs":    map[string]any{"include": "bundles/sample/docs/*.md"},
		}, candidates)

		assert.False(t, got.IsComplete())
		assert.Equal(t, []string{"renamed"}, got.Unresolved)
		assert.Empty(t, got.Parts[1].Matched)
	})

	t.Run("unsafe candidates are skipped rather than failing the bundle", func(t *testing.T) {
		got := resolveFixture(t, map[string]any{
			"all": map[string]any{"include": "bundles/sample/**"},
		}, append([]string{"bundles/sample/.hidden/secret.md", "bundles/sample/ok.md"}, candidates...))

		assert.Contains(t, got.Files, "bundles/sample/ok.md")
		assert.NotContains(t, got.Files, "bundles/sample/.hidden/secret.md")
	})

	t.Run("no selectors resolves to nothing", func(t *testing.T) {
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

	selectors, err := ParseBundleSelectors(bundleObj(map[string]any{
		"all": map[string]any{"include": "bundles/sample/**"},
	}), testManifest)
	require.NoError(t, err)

	_, err = ResolveBundleFiles(selectors, candidates, ResolveOptions{ManifestPath: testManifest})
	require.ErrorIs(t, err, ErrBundleTooManyFiles)

	_, err = ResolveBundleFiles(selectors, candidates[:BundleMaxFiles], ResolveOptions{ManifestPath: testManifest})
	require.NoError(t, err)
}

func TestBundleIndex(t *testing.T) {
	t.Run("claims and releases paths", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"a/one.md", "shared/two.md"})

		assert.Equal(t, []string{"a/bundle.yaml"}, idx.Owners("shared/two.md"))
		assert.True(t, idx.IsClaimed("a/one.md"))
		assert.False(t, idx.IsClaimed("a/unclaimed.md"))
		assert.Equal(t, []string{"a/one.md", "shared/two.md"}, idx.Paths())

		idx.Remove("a/bundle.yaml")
		assert.False(t, idx.IsClaimed("a/one.md"))
		assert.Empty(t, idx.Bundles())
	})

	t.Run("a file may be shared by several bundles", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"shared/two.md", "a/one.md"})
		idx.Add("b/bundle.yaml", []string{"shared/two.md"})

		assert.Equal(t, 2, idx.References("shared/two.md"))
		assert.Equal(t, []string{"a/bundle.yaml", "b/bundle.yaml"}, idx.Owners("shared/two.md"))
	})

	t.Run("a shared file survives until the last bundle lets go", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"shared/two.md"})
		idx.Add("b/bundle.yaml", []string{"shared/two.md"})

		idx.Remove("a/bundle.yaml")
		assert.True(t, idx.IsClaimed("shared/two.md"), "still referenced by b")
		assert.Empty(t, idx.Unreferenced([]string{"shared/two.md"}))

		idx.Remove("b/bundle.yaml")
		assert.False(t, idx.IsClaimed("shared/two.md"))
		assert.Equal(t, []string{"shared/two.md"}, idx.Unreferenced([]string{"shared/two.md"}))
	})

	t.Run("re-adding the same bundle replaces its claims", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"a/one.md", "a/two.md"})
		idx.Add("a/bundle.yaml", []string{"a/two.md", "a/three.md"})

		assert.False(t, idx.IsClaimed("a/one.md"))
		assert.True(t, idx.IsClaimed("a/three.md"))
		assert.Equal(t, []string{"a/two.md", "a/three.md"}, idx.Files("a/bundle.yaml"))
	})

	t.Run("re-adding does not drop a path another bundle still claims", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"shared/two.md"})
		idx.Add("b/bundle.yaml", []string{"shared/two.md"})

		// b stops claiming it; a still does.
		idx.Add("b/bundle.yaml", []string{"b/other.md"})

		assert.True(t, idx.IsClaimed("shared/two.md"))
		assert.Equal(t, []string{"a/bundle.yaml"}, idx.Owners("shared/two.md"))
	})

	t.Run("unreferenced reports only what no bundle claims", func(t *testing.T) {
		idx := NewBundleIndex()
		idx.Add("a/bundle.yaml", []string{"a/kept.md"})

		stored := []string{"a/kept.md", "a/orphan.md", "shared/orphan.md"}
		assert.Equal(t, []string{"a/orphan.md", "shared/orphan.md"}, idx.Unreferenced(stored))
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
