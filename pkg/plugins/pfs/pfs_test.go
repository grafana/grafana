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
		tfs fs.FS
		// TODO could remove this by getting rid of inconsistent subdirs
		subpath string
		skip    string
		err     error
		// TODO could remove this by expecting that dirname == id
		rootid string
	}
	tab := map[string]tt{
		"app-with-child": {
			rootid:  "myorgid-simple-app",
			subpath: "dist",
			skip:    "schema violation, weirdness in info.version field",
		},
		"duplicate-plugins": {
			rootid:  "test-app",
			subpath: "nested",
			skip:    "schema violation, dependencies don't follow naming constraints",
		},
		"includes-symlinks": {
			skip: "schema violation, dependencies don't follow naming constraints",
		},
		"installer": {
			rootid:  "test",
			subpath: "plugin",
		},
		"invalid-plugin-json": {
			rootid: "test-app",
			err:    ErrInvalidRootFile,
		},
		"invalid-v1-signature": {
			rootid:  "test",
			subpath: "plugin",
		},
		"invalid-v2-extra-file": {
			rootid:  "test",
			subpath: "plugin",
		},
		"invalid-v2-missing-file": {
			rootid:  "test",
			subpath: "plugin",
		},
		"lacking-files": {
			rootid:  "test",
			subpath: "plugin",
		},
		"nested-plugins": {
			rootid:  "test-ds",
			subpath: "parent",
		},
		"non-pvt-with-root-url": {
			rootid:  "test",
			subpath: "plugin",
		},
		"symbolic-plugin-dirs": {
			skip: "io/fs-based scanner will not traverse symlinks; caller of ParsePluginFS() must do it",
		},
		"test-app": {
			skip:   "schema violation, dependencies don't follow naming constraints",
			rootid: "test-app",
		},
		"test-app-with-includes": {
			rootid: "test-app",
			skip:   "has a 'page'-type include which isn't a known part of spec",
		},
		"unsigned-datasource": {
			rootid:  "test",
			subpath: "plugin",
		},
		"unsigned-panel": {
			rootid:  "test-panel",
			subpath: "plugin",
		},
		"valid-v2-pvt-signature": {
			rootid:  "test",
			subpath: "plugin",
		},
		"valid-v2-pvt-signature-root-url-uri": {
			rootid:  "test",
			subpath: "plugin",
		},
		"valid-v2-signature": {
			rootid:  "test",
			subpath: "plugin",
		},
		"no-rootfile": {
			err: ErrNoRootFile,
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
				return
			}

			rootp := tree.RootPlugin()
			require.Equal(t, tst.rootid, rootp.Meta().Id, "expected root plugin id and actual root plugin id differ")
		})
	}
}
