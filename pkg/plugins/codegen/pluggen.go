package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	tsast "github.com/grafana/cuetsy/ts/ast"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
)

const tmplTypedef = `{{range .Types}}
{{ with .Schema.Description }}{{ . }}{{ else }}// {{.TypeName}} is the Go representation of a {{.JsonName}}.{{ end }}
//
// THIS TYPE IS INTENDED FOR INTERNAL USE BY THE GRAFANA BACKEND, AND IS SUBJECT TO BREAKING CHANGES.
// Equivalent Go types at stable import paths are provided in https://github.com/grafana/grok.
type {{.TypeName}} {{if and (opts.AliasTypes) (.CanAlias)}}={{end}} {{.Schema.TypeDecl}}
{{end}}
`

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

// PluginTree is a pfs.Tree. It exists so we can add methods for code generation to it.
//
// It is, for now, tailored specifically to Grafana core's codegen needs.
type PluginTree pfs.Tree

func isGroupLineage(slotname string) bool {
	sl, has := kindsys.AllSlots(nil)[slotname]
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

func (pt *PluginTree) GenerateGo(path string, cfg GoGenConfig) (corecodegen.WriteDiffer, error) {
	t := (*pfs.Tree)(pt)
	wd := corecodegen.NewWriteDiffer()

	all := t.SubPlugins()
	if all == nil {
		all = make(map[string]pfs.PluginInfo)
	}
	all[""] = t.RootPlugin()
	for subpath, plug := range all {
		fullp := filepath.Join(path, subpath)
		if cfg.Types {
			gwd, err := pgenGoTypes(plug, path, subpath, cfg.DocPathPrefix)
			if err != nil {
				return nil, fmt.Errorf("error generating go types for %s: %w", fullp, err)
			}
			if err = wd.Merge(gwd); err != nil {
				return nil, fmt.Errorf("error merging file set to generate for %s: %w", fullp, err)
			}
		}
		if cfg.ThemaBindings {
			twd, err := pgenThemaBindings(plug, path, subpath, cfg.DocPathPrefix)
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

func pgenGoTypes(plug pfs.PluginInfo, path, subpath, prefix string) (corecodegen.WriteDiffer, error) {
	wd := corecodegen.NewWriteDiffer()
	for slotname, lin := range plug.SlotImplementations() {
		lowslot := strings.ToLower(slotname)
		rt := lin.Runtime()
		sch := thema.SchemaP(lin, thema.LatestVersion(lin))

		// FIXME gotta hack this out of thema in order to deal with our custom imports :scream:
		f, err := openapi.GenerateSchema(sch, nil)
		if err != nil {
			return nil, fmt.Errorf("thema openapi generation failed: %w", err)
		}

		str, err := yaml.Marshal(rt.Context().BuildFile(f))
		if err != nil {
			return nil, fmt.Errorf("cue-yaml marshaling failed: %w", err)
		}

		loader := openapi3.NewLoader()
		oT, err := loader.LoadFromData([]byte(str))
		if err != nil {
			return nil, fmt.Errorf("loading generated openapi failed; %w", err)
		}

		buf := new(bytes.Buffer)
		if err = tmpls.Lookup("autogen_header.tmpl").Execute(buf, templateVars_autogen_header{
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
			walker: corecodegen.PrefixDropper(strings.Title(lin.Name())),
			in:     buf.Bytes(),
		})
		if err != nil {
			return nil, err
		}

		wd[finalpath] = byt
	}

	return wd, nil
}

func pgenThemaBindings(plug pfs.PluginInfo, path, subpath, prefix string) (corecodegen.WriteDiffer, error) {
	wd := corecodegen.NewWriteDiffer()
	bindings := make([]templateVars_plugin_lineage_binding, 0)
	for slotname, lin := range plug.SlotImplementations() {
		lv := thema.LatestVersion(lin)
		bindings = append(bindings, templateVars_plugin_lineage_binding{
			SlotName:   slotname,
			LatestMajv: lv[0],
			LatestMinv: lv[1],
		})
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("plugin_lineage_file.tmpl").Execute(buf, templateVars_plugin_lineage_file{
		PackageName: sanitizePluginId(plug.Meta().Id),
		PluginType:  string(plug.Meta().Type),
		PluginID:    plug.Meta().Id,
		SlotImpls:   bindings,
		HasModels:   len(bindings) != 0,
		Header: templateVars_autogen_header{
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

// TODO convert this to use cuetsy ts types, once import * form is supported
func convertImport(im *ast.ImportSpec) (tsast.ImportSpec, error) {
	tsim := tsast.ImportSpec{}
	pkg, err := MapCUEImportToTS(strings.Trim(im.Path.Value, "\""))
	if err != nil || pkg == "" {
		// err should be unreachable if paths has been verified already
		// Empty string mapping means skip it
		return tsim, err
	}

	tsim.From = tsast.Str{Value: pkg}

	if im.Name != nil && im.Name.String() != "" {
		tsim.AsName = im.Name.String()
	} else {
		sl := strings.Split(im.Path.Value, "/")
		final := sl[len(sl)-1]
		if idx := strings.Index(final, ":"); idx != -1 {
			tsim.AsName = final[idx:]
		} else {
			tsim.AsName = final
		}
	}
	return tsim, nil
}
