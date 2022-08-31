package codegen

import (
	"bytes"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"text/template"

	"cuelang.org/go/cue/ast"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

// CUE import paths, mapped to corresponding TS import paths. An empty value
// indicates the import path should be dropped in the conversion to TS. Imports
// not present in the list are not not allowed, and code generation will fail.
var importMap = map[string]string{
	"github.com/grafana/thema":                                      "",
	"github.com/grafana/grafana/packages/grafana-schema/src/schema": "@grafana/schema",
}

func init() {
	allow := pfs.PermittedCUEImports()
	strsl := make([]string, 0, len(importMap))
	for p := range importMap {
		strsl = append(strsl, p)
	}

	sort.Strings(strsl)
	sort.Strings(allow)
	if strings.Join(strsl, "") != strings.Join(allow, "") {
		panic("CUE import map is not the same as permitted CUE import list - these files must be kept in sync!")
	}
}

// MapCUEImportToTS maps the provided CUE import path to the corresponding
// TypeScript import path in generated code.
//
// Providing an import path that is not allowed results in an error. If a nil
// error and empty string are returned, the import path should be dropped in
// generated code.
func MapCUEImportToTS(path string) (string, error) {
	i, has := importMap[path]
	if !has {
		return "", fmt.Errorf("import %q in models.cue is not allowed", path)
	}
	return i, nil
}

// ExtractPluginTrees attempts to create a *pfs.Tree for each of the top-level child
// directories in the provided fs.FS.
//
// Errors returned from [pfs.ParsePluginFS] are placed in the option map. Only
// filesystem traversal and read errors will result in a non-nil second return
// value.
func ExtractPluginTrees(parent fs.FS, lib thema.Library) (map[string]PluginTreeOrErr, error) {
	ents, err := fs.ReadDir(parent, ".")
	if err != nil {
		return nil, fmt.Errorf("error reading fs root directory: %w", err)
	}

	ptrees := make(map[string]PluginTreeOrErr)
	for _, plugdir := range ents {
		subpath := plugdir.Name()
		sub, err := fs.Sub(parent, subpath)
		if err != nil {
			return nil, fmt.Errorf("error creating subfs for path %s: %w", subpath, err)
		}

		var either PluginTreeOrErr
		if ptree, err := pfs.ParsePluginFS(sub, lib); err == nil {
			either.Tree = (*PluginTree)(ptree)
		} else {
			either.Err = err
		}
		ptrees[subpath] = either
	}

	return ptrees, nil
}

// PluginTreeOrErr represents either a *pfs.Tree, or the error that occurred
// while trying to create one.
// TODO replace with generic option type after go 1.18
type PluginTreeOrErr struct {
	Err  error
	Tree *PluginTree
}

// PluginTree is a pfs.Tree. It exists so we can add methods for code generation to it.
type PluginTree pfs.Tree

func (pt *PluginTree) GenerateTS(path string) (WriteDiffer, error) {
	t := (*pfs.Tree)(pt)

	// TODO replace with cuetsy's TS AST
	f := &tsFile{}

	pi := t.RootPlugin()
	slotimps := pi.SlotImplementations()
	if len(slotimps) == 0 {
		return nil, nil
	}
	for _, im := range pi.CUEImports() {
		if tsim := convertImport(im); tsim != nil {
			f.Imports = append(f.Imports, tsim)
		}
	}

	for slotname, lin := range slotimps {
		v := thema.LatestVersion(lin)
		sch := thema.SchemaP(lin, v)
		// TODO need call expressions in cuetsy tsast to be able to do these
		sec := tsSection{
			V:         v,
			ModelName: slotname,
		}

		// TODO this is hardcoded for now, but should ultimately be a property of
		// whether the slot is a grouped lineage:
		// https://github.com/grafana/thema/issues/62
		switch slotname {
		case "Panel", "DSConfig":
			b, err := cuetsy.Generate(sch.UnwrapCUE(), cuetsy.Config{})
			if err != nil {
				return nil, fmt.Errorf("%s: error translating %s lineage to TypeScript: %w", path, slotname, err)
			}
			sec.Body = string(b)
		case "Query":
			a, err := cuetsy.GenerateSingleAST(strings.Title(lin.Name()), sch.UnwrapCUE(), cuetsy.TypeInterface)
			if err != nil {
				return nil, fmt.Errorf("%s: error translating %s lineage to TypeScript: %w", path, slotname, err)
			}
			sec.Body = fmt.Sprint(a)
		default:
			panic("unrecognized slot name: " + slotname)
		}

		f.Sections = append(f.Sections, sec)
	}

	wd := NewWriteDiffer()
	var buf bytes.Buffer
	err := tsSectionTemplate.Execute(&buf, f)
	if err != nil {
		return nil, fmt.Errorf("%s: error executing plugin TS generator template: %w", path, err)
	}
	wd[filepath.Join(path, "models.gen.ts")] = buf.Bytes()
	return wd, nil
}

// TODO convert this to use cuetsy ts types, once import * form is supported
func convertImport(im *ast.ImportSpec) *tsImport {
	var err error
	tsim := &tsImport{}
	tsim.Pkg, err = MapCUEImportToTS(strings.Trim(im.Path.Value, "\""))
	if err != nil {
		// should be unreachable if paths has been verified already
		panic(err)
	}

	if tsim.Pkg == "" {
		// Empty string mapping means skip it
		return nil
	}

	if im.Name != nil && im.Name.String() != "" {
		tsim.Ident = im.Name.String()
	} else {
		sl := strings.Split(im.Path.Value, "/")
		final := sl[len(sl)-1]
		if idx := strings.Index(final, ":"); idx != -1 {
			tsim.Pkg = final[idx:]
		} else {
			tsim.Pkg = final
		}
	}
	return tsim
}

type tsFile struct {
	Imports  []*tsImport
	Sections []tsSection
}

type tsSection struct {
	V         thema.SyntacticVersion
	ModelName string
	Body      string
}

type tsImport struct {
	Ident string
	Pkg   string
}

var tsSectionTemplate = template.Must(template.New("cuetsymulti").Parse(`//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This file is autogenerated. DO NOT EDIT.
//
// To regenerate, run "make gen-cue" from the repository root.
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
{{range .Imports}}
import * as {{.Ident}} from '{{.Pkg}}';{{end}}
{{range .Sections}}{{if ne .ModelName "" }}
export const {{.ModelName}}ModelVersion = Object.freeze([{{index .V 0}}, {{index .V 1}}]);
{{end}}
{{.Body}}{{end}}`))
