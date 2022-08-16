package pfs

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/stretchr/testify/require"
)

func TestParseTreeTestdata(t *testing.T) {
	type tt struct {
		tfs     fs.FS
		subpath string // ugh that we have to do this
		skip    string
		err     error
		rootid  string
	}
	tab := map[string]tt{
		"app-with-child": {
			subpath: "dist",
		},
		"duplicate-plugins": {
			subpath: "nested",
		},
		"includes-symlinks": {},
		"installer": {
			subpath: "plugin",
		},
		"invalid-plugin-json": {
			err: ErrInvalidRootFile,
		},
		"invalid-v1-signature": {
			subpath: "plugin",
		},
		"invalid-v2-extra-file": {
			subpath: "plugin",
		},
		"invalid-v2-missing-file": {
			subpath: "plugin",
		},
		"lacking-files": {
			subpath: "plugin",
		},
		"nested-plugins": {
			subpath: "parent",
		},
		"non-pvt-with-root-url": {
			subpath: "plugin",
		},
		"symbolic-plugin-dirs": {
			skip: "io/fs-based scanner will not traverse symlinks; caller of ParsePluginFS() must do it",
		},
		"test-app":               {},
		"test-app-with-includes": {},
		"unsigned-datasource": {
			subpath: "plugin",
		},
		"unsigned-panel": {
			subpath: "plugin",
		},
		"valid-v2-pvt-signature": {
			subpath: "plugin",
		},
		"valid-v2-pvt-signature-root-url-uri": {
			subpath: "plugin",
		},
		"valid-v2-signature": {
			subpath: "plugin",
		},
	}

	staticRootPath, err := filepath.Abs("../manager/testdata")
	require.NoError(t, err)
	dfs := os.DirFS(staticRootPath)
	ents, err := fs.ReadDir(dfs, ".")
	require.NoError(t, err)

	// Ensure table test and dir list are ==
	var dirs, tts []string
	for k := range tab {
		tts = append(tts, k)
	}
	for _, ent := range ents {
		dirs = append(dirs, ent.Name())
	}
	sort.Strings(tts)
	sort.Strings(dirs)
	if !cmp.Equal(tts, dirs) {
		t.Fatalf("table test map (-) and pkg/plugins/manager/testdata dirs (+) differ: %s", cmp.Diff(tts, dirs))
	}

	for _, ent := range ents {
		tst := tab[ent.Name()]
		tst.tfs, err = fs.Sub(dfs, filepath.Join(ent.Name(), tst.subpath))
		require.NoError(t, err)
		tab[ent.Name()] = tst
	}

	lib := cuectx.ProvideThemaLibrary()
	for name, otst := range tab {
		tst := otst // otherwise var is shadowed within func by looping
		t.Run(name, func(t *testing.T) {
			if tst.skip != "" {
				t.Skip(tst.skip)
			}

			tree, err := ParsePluginFS(tst.tfs, lib)
			if tst.err == nil {
				require.NoError(t, err, "unexpected error while parsing plugin tree")
			} else {
				require.ErrorIs(t, err, tst.err, "unexpected error type while parsing plugin tree")
			}

			rootp := tree.RootPlugin()
			require.Equal(t, tst.rootid, rootp.Meta().Id, "expected root plugin id and actual root plugin id differ")
		})
	}
}
