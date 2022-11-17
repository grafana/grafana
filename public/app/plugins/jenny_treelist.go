package plugins

import (
	"bytes"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
)

func PluginTreeListJenny() codejen.ManyToOne[*PluginDecl] {
	return &ptlJenny{}
}

type ptlJenny struct {
}

func (gen *ptlJenny) JennyName() string {
	return "PluginTreeListJenny"
}

func (gen *ptlJenny) Generate(decls ...*PluginDecl) (*codejen.File, error) {
	buf := new(bytes.Buffer)
	vars := tvars_plugin_registry{
		Header: tvars_autogen_header{
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

	tmplname := "plugin_registry.tmpl"

	if err := tmpls.Lookup(tmplname).Execute(buf, vars); err != nil {
		return nil, fmt.Errorf("failed executing plugin registry template: %w", err)
	}

	byt, err := postprocessGoFile(genGoFile{
		path: target,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("error postprocessing plugin registry: %w", err)
	}

	return codejen.NewFile(path, byt, gen), nil
}
