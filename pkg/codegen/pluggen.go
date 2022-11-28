package codegen

import (
	"bytes"
	"fmt"
	"io/fs"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
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
//
// It is, for now, tailored specifically to Grafana core's codegen needs.
type PluginTree pfs.Tree

func (pt *PluginTree) GenerateTS(path string) (WriteDiffer, error) {
	t := (*pfs.Tree)(pt)

	// TODO replace with cuetsy's TS AST
	f := &tvars_cuetsy_multi{
		Header: tvars_autogen_header{
			GeneratorPath: "public/app/plugins/gen.go", // FIXME hardcoding is not OK
			LineagePath:   "models.cue",
		},
	}

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

		if isGroupLineage(slotname) {
			b, err := cuetsy.Generate(sch.UnwrapCUE(), cuetsy.Config{})
			if err != nil {
				return nil, fmt.Errorf("%s: error translating %s lineage to TypeScript: %w", path, slotname, err)
			}
			sec.Body = string(b)
		} else {
			a, err := cuetsy.GenerateSingleAST(strings.Title(lin.Name()), sch.UnwrapCUE(), cuetsy.TypeInterface)
			if err != nil {
				return nil, fmt.Errorf("%s: error translating %s lineage to TypeScript: %w", path, slotname, err)
			}
			sec.Body = fmt.Sprint(a)
		}

		f.Sections = append(f.Sections, sec)
	}

	wd := NewWriteDiffer()
	var buf bytes.Buffer
	err := tmpls.Lookup("cuetsy_multi.tmpl").Execute(&buf, f)
	if err != nil {
		return nil, fmt.Errorf("%s: error executing plugin TS generator template: %w", path, err)
	}
	wd[filepath.Join(path, "models.gen.ts")] = buf.Bytes()
	return wd, nil
}

func isGroupLineage(slotname string) bool {
	sl, has := coremodel.AllSlots()[slotname]
	if !has {
		panic("unknown slotname name: " + slotname)
	}
	return sl.IsGroup()
}

type GoGenConfig struct {
	// Types indicates whether corresponding Go types should be generated from the
	// latest version in the lineage(s).
	Types bool

	// ThemaBindings indicates whether Thema bindings (an implementation of
	// ["github.com/grafana/thema".LineageFactory]) should be generated for
	// lineage(s).
	ThemaBindings bool

	// DocPathPrefix allows the caller to optionally specify a path to be prefixed
	// onto paths generated for documentation. This is useful for io/fs-based code
	// generators, which typically only have knowledge of paths relative to the fs.FS
	// root, typically an encapsulated subpath, but docs are easier to understand when
	// paths are relative to a repository root.
	//
	// Note that all paths are normalized to use slashes, regardless of the
	// OS running the code generator.
	DocPathPrefix string
}

func (pt *PluginTree) GenerateGo(path string, cfg GoGenConfig) (WriteDiffer, error) {
	t := (*pfs.Tree)(pt)
	wd := NewWriteDiffer()

	all := t.SubPlugins()
	if all == nil {
		all = make(map[string]pfs.PluginInfo)
	}
	all[""] = t.RootPlugin()
	for subpath, plug := range all {
		fullp := filepath.Join(path, subpath)
		if cfg.Types {
			gwd, err := genGoTypes(plug, path, subpath, cfg.DocPathPrefix)
			if err != nil {
				return nil, fmt.Errorf("error generating go types for %s: %w", fullp, err)
			}
			if err = wd.Merge(gwd); err != nil {
				return nil, fmt.Errorf("error merging file set to generate for %s: %w", fullp, err)
			}
		}
		if cfg.ThemaBindings {
			twd, err := genThemaBindings(plug, path, subpath, cfg.DocPathPrefix)
			if err != nil {
				return nil, fmt.Errorf("error generating thema bindings for %s: %w", fullp, err)
			}
			if err = wd.Merge(twd); err != nil {
				return nil, fmt.Errorf("error merging file set to generate for %s: %w", fullp, err)
			}
		}
	}

	return wd, nil
}

func genGoTypes(plug pfs.PluginInfo, path, subpath, prefix string) (WriteDiffer, error) {
	wd := NewWriteDiffer()
	for slotname, lin := range plug.SlotImplementations() {
		lowslot := strings.ToLower(slotname)
		lib := lin.Library()
		sch := thema.SchemaP(lin, thema.LatestVersion(lin))

		// FIXME gotta hack this out of thema in order to deal with our custom imports :scream:
		f, err := openapi.GenerateSchema(sch, nil)
		if err != nil {
			return nil, fmt.Errorf("thema openapi generation failed: %w", err)
		}

		str, err := yaml.Marshal(lib.Context().BuildFile(f))
		if err != nil {
			return nil, fmt.Errorf("cue-yaml marshaling failed: %w", err)
		}

		loader := openapi3.NewLoader()
		oT, err := loader.LoadFromData([]byte(str))
		if err != nil {
			return nil, fmt.Errorf("loading generated openapi failed; %w", err)
		}

		buf := new(bytes.Buffer)
		if err = tmpls.Lookup("autogen_header.tmpl").Execute(buf, tvars_autogen_header{
			GeneratorPath:  "public/app/plugins/gen.go", // FIXME hardcoding is not OK
			LineagePath:    filepath.ToSlash(filepath.Join(prefix, subpath, "models.cue")),
			LineageCUEPath: slotname,
			GenLicense:     true,
		}); err != nil {
			return nil, fmt.Errorf("error generating file header: %w", err)
		}

		cgopt := codegen.Options{
			GenerateTypes: true,
			SkipPrune:     true,
			SkipFmt:       true,
			UserTemplates: map[string]string{
				"imports.tmpl": "package {{ .PackageName }}",
				"typedef.tmpl": tmplTypedef,
			},
		}
		if isGroupLineage(slotname) {
			cgopt.ExcludeSchemas = []string{lin.Name()}
		}

		gostr, err := codegen.Generate(oT, lin.Name(), cgopt)
		if err != nil {
			return nil, fmt.Errorf("openapi generation failed: %w", err)
		}
		fmt.Fprint(buf, gostr)

		finalpath := filepath.Join(path, subpath, fmt.Sprintf("types_%s_gen.go", lowslot))
		byt, err := postprocessGoFile(genGoFile{
			path:   finalpath,
			walker: makePrefixDropper(strings.Title(lin.Name()), slotname),
			in:     buf.Bytes(),
		})
		if err != nil {
			return nil, err
		}

		wd[finalpath] = byt
	}

	return wd, nil
}

func genThemaBindings(plug pfs.PluginInfo, path, subpath, prefix string) (WriteDiffer, error) {
	wd := NewWriteDiffer()
	bindings := make([]tvars_plugin_lineage_binding, 0)
	for slotname, lin := range plug.SlotImplementations() {
		lv := thema.LatestVersion(lin)
		bindings = append(bindings, tvars_plugin_lineage_binding{
			SlotName:   slotname,
			LatestMajv: lv[0],
			LatestMinv: lv[1],
		})
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("plugin_lineage_file.tmpl").Execute(buf, tvars_plugin_lineage_file{
		PackageName: sanitizePluginId(plug.Meta().Id),
		PluginType:  string(plug.Meta().Type),
		PluginID:    plug.Meta().Id,
		SlotImpls:   bindings,
		HasModels:   len(bindings) != 0,
		Header: tvars_autogen_header{
			GeneratorPath: "public/app/plugins/gen.go", // FIXME hardcoding is not OK
			GenLicense:    true,
			LineagePath:   filepath.Join(prefix, subpath),
		},
	}); err != nil {
		return nil, fmt.Errorf("error executing plugin lineage file template: %w", err)
	}

	fullpath := filepath.Join(path, subpath, "pfs_gen.go")
	if byt, err := postprocessGoFile(genGoFile{
		path: fullpath,
		in:   buf.Bytes(),
	}); err != nil {
		return nil, err
	} else {
		wd[fullpath] = byt
	}

	return wd, nil
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

// FIXME unexport this and refactor, this is way too one-off to be in here
func GenPluginTreeList(trees []TreeAndPath, prefix, target string, ref bool) (WriteDiffer, error) {
	buf := new(bytes.Buffer)
	vars := tvars_plugin_registry{
		Header: tvars_autogen_header{
			GenLicense: true,
		},
		Plugins: make([]struct {
			PkgName, Path, ImportPath string
			NoAlias                   bool
		}, 0, len(trees)),
	}

	type tpl struct {
		PkgName, Path, ImportPath string
		NoAlias                   bool
	}

	// No sub-plugin support here. If we never allow subplugins in core, that's probably fine.
	// But still worth noting.
	for _, pt := range trees {
		rp := (*pfs.Tree)(pt.Tree).RootPlugin()
		vars.Plugins = append(vars.Plugins, tpl{
			PkgName:    sanitizePluginId(rp.Meta().Id),
			NoAlias:    sanitizePluginId(rp.Meta().Id) != filepath.Base(pt.Path),
			ImportPath: filepath.ToSlash(filepath.Join(prefix, pt.Path)),
			Path:       path.Join(append(strings.Split(prefix, "/")[3:], pt.Path)...),
		})
	}

	tmplname := "plugin_registry.tmpl"
	if ref {
		tmplname = "plugin_registry_ref.tmpl"
	}

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

	wd := NewWriteDiffer()
	wd[target] = byt
	return wd, nil
}

// FIXME unexport this and refactor, this is way too one-off to be in here
type TreeAndPath struct {
	Tree *PluginTree
	// path relative to path prefix UUUGHHH (basically {panel,datasource}/<dir>}
	Path string
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

type tsSection struct {
	V         thema.SyntacticVersion
	ModelName string
	Body      string
}

type tsImport struct {
	Ident string
	Pkg   string
}
