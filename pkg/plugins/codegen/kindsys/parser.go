package kindsys

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"

	corecodegen "github.com/grafana/grafana/pkg/codegen"
	corekindsys "github.com/grafana/grafana/pkg/kindsys"
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
	matches, err := fs.Glob(root, "**/**/plugin.json")
	if err != nil {
		return nil, fmt.Errorf("error finding plugin dirs: %w", err)
	}

	decls := make([]*PluginDecl, 0)
	for _, match := range matches {
		path := filepath.Dir(match)
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
			kind := &corekindsys.SomeDecl{
				V: lin.Underlying(),
				Meta: corekindsys.ComposableMeta{
					CommonMeta: corekindsys.CommonMeta{
						Name:              base,
						MachineName:       path, // hack should be changed soon
						PluralName:        base + "s",
						PluralMachineName: base + "s",
					},
					CurrentVersion: lin.Latest().Version(),
				},
			}

			decls = append(decls, &PluginDecl{
				Path:       path,
				Slot:       slot,
				DeclForGen: corecodegen.DeclForGenFromLineage(kind, lin),
				PluginMeta: p.Meta(),
			})
		}
	}

	sort.Slice(decls, func(i, j int) bool {
		return decls[i].Path < decls[j].Path
	})

	return decls, nil
}
