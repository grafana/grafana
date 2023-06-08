package pfs

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/build"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

type declParser struct {
	rt   *thema.Runtime
	skip map[string]bool
}

func NewDeclParser(rt *thema.Runtime, skip map[string]bool) *declParser {
	return &declParser{
		rt:   rt,
		skip: skip,
	}
}

// TODO convert this to be the new parser for Tree
func (psr *declParser) Parse(root fs.FS) ([]*PluginDecl, error) {
	// TODO remove hardcoded tree structure assumption, work from root of provided fs
	plugins, err := fs.Glob(root, "**/**/plugin.json")
	if err != nil {
		return nil, fmt.Errorf("error finding plugin dirs: %w", err)
	}

	grafanaVersion := getGrafanaVersion()

	decls := make([]*PluginDecl, 0)
	for _, plugin := range plugins {
		path := filepath.ToSlash(filepath.Dir(plugin))
		base := filepath.Base(path)
		if skip, ok := psr.skip[base]; ok && skip {
			continue
		}

		dir, _ := fs.Sub(root, path)
		pp, err := ParsePluginFS(dir, psr.rt)
		if err != nil {
			return nil, fmt.Errorf("parsing plugin failed for %s: %s", dir, err)
		}

		if len(pp.ComposableKinds) == 0 {
			decls = append(decls, EmptyPluginDecl(path, pp.Properties))
			continue
		}

		for slotName, kind := range pp.ComposableKinds {
			slot, err := kindsys.FindSchemaInterface(slotName)
			if err != nil {
				return nil, fmt.Errorf("parsing plugin failed for %s: %s", dir, err)
			}
			decls = append(decls, &PluginDecl{
				SchemaInterface: &slot,
				Lineage:         kind.Lineage(),
				Imports:         pp.CUEImports,
				PluginMeta:      pp.Properties,
				PluginPath:      path,
				KindDecl:        kind.Def(),
				GrafanaVersion:  grafanaVersion,
			})
		}
	}

	sort.Slice(decls, func(i, j int) bool {
		return decls[i].PluginPath < decls[j].PluginPath
	})

	return decls, nil
}

func getGrafanaVersion() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	pkg, err := build.OpenPackageJSON(path.Join(dir, "../../../"))
	if err != nil {
		return ""
	}

	return pkg.Version
}
