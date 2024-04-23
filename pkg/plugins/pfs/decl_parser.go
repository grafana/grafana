package pfs

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"

	"cuelang.org/go/cue/cuecontext"
)

type DeclParser struct {
	skip map[string]bool
}

func NewDeclParser(skip map[string]bool) *DeclParser {
	return &DeclParser{
		skip: skip,
	}
}

// TODO convert this to be the new parser for Tree
func (psr *DeclParser) Parse(root fs.FS) ([]*PluginDecl, error) {
	ctx := cuecontext.New()
	// TODO remove hardcoded tree structure assumption, work from root of provided fs
	plugins, err := fs.Glob(root, "**/**/plugin.json")
	if err != nil {
		return nil, fmt.Errorf("error finding plugin dirs: %w", err)
	}

	decls := make([]*PluginDecl, 0)
	for _, plugin := range plugins {
		path := filepath.ToSlash(filepath.Dir(plugin))
		base := filepath.Base(path)
		if skip, ok := psr.skip[base]; ok && skip {
			continue
		}

		dir, _ := fs.Sub(root, path)
		pp, err := ParsePluginFS(ctx, dir, path)
		if err != nil {
			return nil, fmt.Errorf("parsing plugin failed for %s: %s", dir, err)
		}

		if !pp.CueFile.Exists() {
			continue
		}

		decls = append(decls, &PluginDecl{
			SchemaInterface: pp.Variant,
			CueFile:         pp.CueFile,
			Imports:         pp.CUEImports,
			PluginMeta:      pp.Properties,
			PluginPath:      path,
		})
	}

	sort.Slice(decls, func(i, j int) bool {
		return decls[i].PluginPath < decls[j].PluginPath
	})

	return decls, nil
}
