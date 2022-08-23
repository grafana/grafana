package pfs

import (
	"archive/zip"
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
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"invalid-plugin-json": {
			rootid: "test-app",
			err:    ErrInvalidRootFile,
		},
		"invalid-v1-signature": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"invalid-v2-extra-file": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"invalid-v2-missing-file": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"lacking-files": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"nested-plugins": {
			rootid:  "test-datasource",
			subpath: "parent",
		},
		"non-pvt-with-root-url": {
			rootid:  "test-datasource",
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
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"unsigned-panel": {
			rootid:  "test-panel",
			subpath: "plugin",
		},
		"valid-v2-pvt-signature": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"valid-v2-pvt-signature-root-url-uri": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"valid-v2-signature": {
			rootid:  "test-datasource",
			subpath: "plugin",
		},
		"no-rootfile": {
			err: ErrNoRootFile,
		},
		"valid-model-panel":      {},
		"valid-model-datasource": {},
		"wrong-slot-panel": {
			err: ErrImplementedSlots,
		},
		"missing-slot-impl": {
			err: ErrImplementedSlots,
		},
		"panel-conflicting-joinschema": {
			err:  ErrInvalidLineage,
			skip: "TODO implement BindOption in thema, SatisfiesJoinSchema, then use it here",
		},
		"panel-does-not-follow-slot-joinschema": {
			err:  ErrInvalidLineage,
			skip: "TODO implement BindOption in thema, SatisfiesJoinSchema, then use it here",
		},
		"name-id-mismatch": {
			err: ErrLineageNameMismatch,
		},
		"mismatch": {
			err: ErrLineageNameMismatch,
		},
		"disallowed-cue-import": {
			err: ErrDisallowedCUEImport,
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

			if tst.rootid == "" {
				tst.rootid = name
			}

			rootp := tree.RootPlugin()
			require.Equal(t, tst.rootid, rootp.Meta().Id, "expected root plugin id and actual root plugin id differ")
		})
	}
}

func TestParseTreeZips(t *testing.T) {
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
		"grafana-simple-json-datasource-ec18fa4da8096a952608a7e4c7782b4260b41bcf.zip": {
			skip: "binary plugin",
		},
		"plugin-with-absolute-member.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-absolute-symlink-dir.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-absolute-symlink.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-parent-member.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-symlink-dir.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-symlink.zip": {
			skip: "not actually a plugin, no plugin.json?",
		},
		"plugin-with-symlinks.zip": {
			subpath: "test-app",
			rootid:  "test-app",
		},
	}

	staticRootPath, err := filepath.Abs("../storage/testdata")
	require.NoError(t, err)
	ents, err := os.ReadDir(staticRootPath)
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
		t.Fatalf("table test map (-) and pkg/plugins/installer/testdata dirs (+) differ: %s", cmp.Diff(tts, dirs))
	}

	for _, ent := range ents {
		tst := tab[ent.Name()]
		r, err := zip.OpenReader(filepath.Join(staticRootPath, ent.Name()))
		require.NoError(t, err)
		defer r.Close() //nolint:errcheck
		if tst.subpath != "" {
			tst.tfs, err = fs.Sub(r, tst.subpath)
			require.NoError(t, err)
		} else {
			tst.tfs = r
		}

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

			if tst.rootid == "" {
				tst.rootid = name
			}

			rootp := tree.RootPlugin()
			require.Equal(t, tst.rootid, rootp.Meta().Id, "expected root plugin id and actual root plugin id differ")
		})
	}
}
