package grafana

import (
	"embed"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"github.com/grafana/testdata"
	"github.com/yalue/merged_fs"
)

// CueSchemaFS embeds all schema-related CUE files in the Grafana project.
//
//go:embed cue.mod/module.cue kinds/*.cue kinds/*/*.cue packages/grafana-schema/src/common/*.cue public/app/plugins/*/*/*.cue public/app/plugins/*/*/plugin.json pkg/plugins/*/*.cue
var cueSchemaFS embed.FS

var CueSchemaFS fs.FS = merged_fs.MergeMultiple(cueSchemaFS, prefixFS("public/plugins/testdata", testdata.CueSchemaFS))

func prefixFS(prefix string, fsys fs.FS) fs.FS {
	m := make(fstest.MapFS)

	prefix = filepath.FromSlash(prefix)
	err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		b, err := fs.ReadFile(fsys, filepath.ToSlash(path))
		if err != nil {
			return err
		}
		// fstest can recognize only forward slashes.
		m[filepath.ToSlash(filepath.Join(prefix, path))] = &fstest.MapFile{Data: b}
		return nil
	})

	if err != nil {
		panic(err)
	}

	return m
}
