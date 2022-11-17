package codegen

import (
	"bytes"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

const prefix = "github.com/grafana/grafana/public/app/plugins"

// PluginTreeDeclForGen is the data structure used as input for
// [PluginTreeListJenny].
type PluginTreeDeclForGen struct {
	Path string
	Tree pfs.Tree
}

// PluginTreeListJenny creates a [codejen.ManyToOne] that produces Go code
// for loading a [pfs.TreeList] given [*PluginTreeDeclForGen] as inputs.
//
// An outputFile must be provided which should be relative to your working directory.
func PluginTreeListJenny(outputFile string) codejen.ManyToOne[*PluginTreeDeclForGen] {
	if filepath.IsAbs(outputFile) {
		panic("outputFile must be relative")
	}

	return &ptlJenny{
		outputFile: outputFile,
	}
}

type ptlJenny struct {
	outputFile string
}

func (gen *ptlJenny) JennyName() string {
	return "PluginTreeListJenny"
}

func (gen *ptlJenny) Generate(decls ...*PluginTreeDeclForGen) (*codejen.File, error) {
	buf := new(bytes.Buffer)
	vars := templateVars_plugin_registry{
		Header: templateVars_autogen_header{
			GenLicense: true,
		},
		Plugins: make([]struct {
			PkgName, Path, ImportPath string
			NoAlias                   bool
		}, 0, len(decls)),
	}

	type tpl struct {
		PkgName, Path, ImportPath string
		NoAlias                   bool
	}

	// No sub-plugin support here. If we never allow subplugins in core, that's probably fine.
	// But still worth noting.
	for _, decl := range decls {
		rp := decl.Tree.RootPlugin()
		vars.Plugins = append(vars.Plugins, tpl{
			PkgName:    sanitizePluginId(rp.Meta().Id),
			NoAlias:    sanitizePluginId(rp.Meta().Id) != filepath.Base(decl.Path),
			ImportPath: filepath.ToSlash(filepath.Join(prefix, decl.Path)),
			Path:       path.Join(append(strings.Split(prefix, "/")[3:], decl.Path)...),
		})
	}

	if err := tmpls.Lookup("plugin_registry.tmpl").Execute(buf, vars); err != nil {
		return nil, fmt.Errorf("failed executing plugin registry template: %w", err)
	}

	byt, err := postprocessGoFile(genGoFile{
		path: gen.outputFile,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("error postprocessing plugin registry: %w", err)
	}

	return codejen.NewFile(gen.outputFile, byt, gen), nil
}
