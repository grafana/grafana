package kindsys

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/plugins/pfs"
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

func (psr *declParser) Parse(root fs.FS) ([]*PluginDecl, error) {
	plugins, err := fs.Glob(root, "**/**/plugin.json")
	if err != nil {
		return nil, fmt.Errorf("error finding plugin dirs: %w", err)
	}

	decls := make([]*PluginDecl, 0)
	for _, plugin := range plugins {
		path := filepath.Dir(plugin)
		base := filepath.Base(path)
		if skip, ok := psr.skip[base]; ok && skip {
			continue
		}

		dir := os.DirFS(path)
		ptree, err := pfs.ParsePluginFS(dir, psr.rt)
		if err != nil {
			log.Println(fmt.Errorf("parsing plugin failed for %s: %s", dir, err))
			continue
		}

		p := ptree.RootPlugin()
		slots := p.SlotImplementations()

		for slot, lin := range slots {
			decls = append(decls, &PluginDecl{
				Slot:       slot, //FIXME should return kindsys.Slot instead of slot name
				Lineage:    lin,
				PluginMeta: p.Meta(),
				PluginPath: path,
			})
		}
	}

	sort.Slice(decls, func(i, j int) bool {
		return decls[i].PluginPath < decls[j].PluginPath
	})

	return decls, nil
}
