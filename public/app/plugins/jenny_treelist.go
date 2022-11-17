package plugins

import (
	"bytes"
	"fmt"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"golang.org/x/tools/go/ast/astutil"
	"golang.org/x/tools/imports"
)

const prefix = "github.com/grafana/grafana/public/app/plugins"

func PluginTreeListJenny() codejen.ManyToOne[*PluginDecl] {
	target := filepath.Join("pkg", "plugins", "pfs", "corelist", "loadlist_gen.go")

	return &ptlJenny{
		target: target,
	}
}

type ptlJenny struct {
	target string
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

	if err := tmpls.Lookup("plugin_registry.tmpl").Execute(buf, vars); err != nil {
		return nil, fmt.Errorf("failed executing plugin registry template: %w", err)
	}

	byt, err := postprocessGoFile(genGoFile{
		path: gen.target,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("error postprocessing plugin registry: %w", err)
	}

	return codejen.NewFile(gen.target, byt, gen), nil
}

// Plugin IDs are allowed to contain characters that aren't allowed in CUE
// package names, Go package names, TS or Go type names, etc.
// TODO expose this as standard
func sanitizePluginId(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			fallthrough
		case r >= 'A' && r <= 'Z':
			fallthrough
		case r >= '0' && r <= '9':
			fallthrough
		case r == '_':
			return r
		case r == '-':
			return '_'
		default:
			return -1
		}
	}, s)
}

type genGoFile struct {
	path   string
	walker astutil.ApplyFunc
	in     []byte
}

func postprocessGoFile(cfg genGoFile) ([]byte, error) {
	fname := filepath.Base(cfg.path)
	buf := new(bytes.Buffer)
	fset := token.NewFileSet()
	gf, err := parser.ParseFile(fset, fname, string(cfg.in), parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("error parsing generated file: %w", err)
	}

	if cfg.walker != nil {
		astutil.Apply(gf, cfg.walker, nil)

		err = format.Node(buf, fset, gf)
		if err != nil {
			return nil, fmt.Errorf("error formatting Go AST: %w", err)
		}
	} else {
		buf = bytes.NewBuffer(cfg.in)
	}

	byt, err := imports.Process(fname, buf.Bytes(), nil)
	if err != nil {
		return nil, fmt.Errorf("goimports processing failed: %w", err)
	}

	// Compare imports before and after; warn about performance if some were added
	gfa, _ := parser.ParseFile(fset, fname, string(byt), parser.ParseComments)
	imap := make(map[string]bool)
	for _, im := range gf.Imports {
		imap[im.Path.Value] = true
	}
	var added []string
	for _, im := range gfa.Imports {
		if !imap[im.Path.Value] {
			added = append(added, im.Path.Value)
		}
	}

	if len(added) != 0 {
		// TODO improve the guidance in this error if/when we better abstract over imports to generate
		fmt.Fprintf(os.Stderr, "The following imports were added by goimports while generating %s: \n\t%s\nRelying on goimports to find imports significantly slows down code generation. Consider adding these to the relevant template.\n", cfg.path, strings.Join(added, "\n\t"))
	}

	return byt, nil
}
