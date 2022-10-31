// go:build ignore
//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/load"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/cuetsy/ts/ast"
	gcgen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
)

const sep = string(filepath.Separator)

var tsroot, cmroot, groot string

func init() {
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}

	// TODO this binds us to only having coremodels in a single directory. If we need more, compgen is the way
	groot = filepath.Dir(filepath.Dir(filepath.Dir(cwd))) // the working dir is <grafana_dir>/pkg/framework/coremodel. Going up 3 dirs we get the grafana root

	cmroot = filepath.Join(groot, "pkg", "coremodel")
	tsroot = filepath.Join(groot, "packages", "grafana-schema", "src")
}

// Generate Go and Typescript implementations for all coremodels, and populate the
// coremodel static registry.
func main() {
	rt := cuectx.GrafanaThemaRuntime()
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "coremodel code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	items, err := os.ReadDir(cmroot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not read coremodels parent dir %s: %s\n", cmroot, err)
		os.Exit(1)
	}

	var lins []*gcgen.CoremodelDeclaration
	for _, item := range items {
		if item.IsDir() {
			lin, err := gcgen.ExtractLineage(filepath.Join(cmroot, item.Name(), "coremodel.cue"), rt)
			if err != nil {
				fmt.Fprintf(os.Stderr, "could not process coremodel dir %s: %s\n", filepath.Join(cmroot, item.Name()), err)
				os.Exit(1)
			}

			lins = append(lins, lin)
		}
	}
	sort.Slice(lins, func(i, j int) bool {
		return lins[i].Lineage.Name() < lins[j].Lineage.Name()
	})

	// The typescript veneer index.gen.ts file, which we'll build up over time
	// from the exported types.
	tsvidx := new(ast.File)
	wd := gcgen.NewWriteDiffer()
	for _, ls := range lins {
		gofiles, err := ls.GenerateGoCoremodel(filepath.Join(cmroot, ls.Lineage.Name()))
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to generate Go for %s: %s\n", ls.Lineage.Name(), err)
			os.Exit(1)
		}
		wd.Merge(gofiles)

		// Only generate TS for API types
		if ls.IsAPIType {
			tsf, err := ls.GenerateTypescriptCoremodel()
			if err != nil {
				fmt.Fprintf(os.Stderr, "error generating TypeScript for %s: %s\n", ls.Lineage.Name(), err)
				os.Exit(1)
			}
			tsf.Doc = mkTSHeader(ls)
			wd[filepath.FromSlash(filepath.Join(tsroot, rawTSGenPath(ls)))] = []byte(tsf.String())

			decls, err := extractTSIndexVeneerElements(ls, tsf)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error generating TypeScript veneer for %s: %s\n", ls.Lineage.Name(), errors.Details(err, nil))
				os.Exit(1)
			}
			tsvidx.Nodes = append(tsvidx.Nodes, decls...)
		}
	}

	tsvidx.Doc = mkTSHeader(nil)
	wd[filepath.Join(tsroot, "index.gen.ts")] = []byte(tsvidx.String())

	regfiles, err := gcgen.GenerateCoremodelRegistry(filepath.Join(groot, "pkg", "framework", "coremodel", "registry", "registry_gen.go"), lins)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to generate coremodel registry: %s\n", err)
		os.Exit(1)
	}
	wd.Merge(regfiles)

	// TODO generating these is here temporarily until we make a more permanent home
	wdsh, err := genSharedSchemas(groot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "TS gen error for shared schemas in %s: %w", filepath.Join(groot, "packages", "grafana-schema", "src", "schema"), err)
		os.Exit(1)
	}
	wd.Merge(wdsh)

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		err = wd.Verify()
		if err != nil {
			fmt.Fprintf(os.Stderr, "generated code is not up to date:\n%s\nrun `make gen-cue` to regenerate\n\n", err)
			os.Exit(1)
		}
	} else {
		err = wd.Write()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error while writing generated code to disk:\n%s\n", err)
			os.Exit(1)
		}
	}
}

// generates the path relative to packages/grafana-schema/src at which the raw
// type definitions should be exported for the latest schema of this type
func rawTSGenPath(cm *gcgen.CoremodelDeclaration) string {
	return fmt.Sprintf("raw/%s/%s/%s.gen.ts", cm.Lineage.Name(), cm.PathVersion(), cm.Lineage.Name())
}

func mkTSHeader(cm *gcgen.CoremodelDeclaration) *ast.Comment {
	v := gcgen.HeaderVars{
		GeneratorPath: "pkg/framework/coremodel/gen.go",
	}
	if cm != nil {
		v.LineagePath = cm.RelativePath
	}
	v.GeneratorPath = "pkg/framework/coremodel/gen.go"
	return &ast.Comment{
		Text: strings.TrimSpace(gcgen.GenGrafanaHeader(v)),
	}
}

func genSharedSchemas(groot string) (gcgen.WriteDiffer, error) {
	abspath := filepath.Join(groot, "packages", "grafana-schema", "src", "schema")
	cfg := &load.Config{
		ModuleRoot: groot,
		Module:     "github.com/grafana/grafana",
		Dir:        abspath,
	}

	bi := load.Instances(nil, cfg)
	if len(bi) > 1 {
		return nil, fmt.Errorf("loading CUE files in %s resulted in more than one instance", abspath)
	}

	ctx := cuecontext.New()
	v := ctx.BuildInstance(bi[0])
	if v.Err() != nil {
		return nil, fmt.Errorf("errors while building CUE in %s: %s", abspath, v.Err())
	}

	b, err := cuetsy.Generate(v, cuetsy.Config{
		Export: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate TS: %w", err)
	}

	wd := gcgen.NewWriteDiffer()
	wd[filepath.Join(abspath, "mudball.gen.ts")] = append([]byte(`//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This file is autogenerated. DO NOT EDIT.
//
// To regenerate, run "make gen-cue" from the repository root.
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
`), b...)
	return wd, nil
}

// TODO make this more generic and reusable
func extractTSIndexVeneerElements(cm *gcgen.CoremodelDeclaration, tf *ast.File) ([]ast.Decl, error) {
	lin := cm.Lineage
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))

	// Check the root, then walk the tree
	rootv := sch.UnwrapCUE()

	var raw, custom, rawD, customD ast.Idents

	var terr errors.Error
	visit := func(p cue.Path, wv cue.Value) bool {
		var name string
		sels := p.Selectors()
		switch len(sels) {
		case 0:
			name = strings.Title(cm.Lineage.Name())
			fallthrough
		case 1:
			// Only deal with subpaths that are definitions, for now
			// TODO incorporate smarts about grouped lineages here
			if name == "" {
				if !sels[0].IsDefinition() {
					return false
				}
				// It might seem to make sense that we'd strip out the leading # here for
				// definitions. However, cuetsy's tsast actually has the # still present in its
				// Ident types, stripping it out on the fly when stringifying.
				name = sels[0].String()
			}

			// Search the generated TS AST for the type and default decl nodes
			pair := findDeclNode(name, tf)
			if pair.T == nil {
				// No generated type for this item, skip it
				return false
			}

			cust, perr := getCustomVeneerAttr(wv)
			if perr != nil {
				terr = errors.Append(terr, errors.Promote(perr, fmt.Sprintf("%s: ", p.String())))
			}
			var has bool
			for _, tgt := range cust {
				has = has || tgt.target == "type"
			}
			if has {
				// enums can't use 'export type'
				if pair.isEnum {
					customD = append(customD, *pair.T)
				} else {
					custom = append(custom, *pair.T)
				}

				if pair.D != nil {
					customD = append(customD, *pair.D)
				}
			} else {
				// enums can't use 'export type'
				if pair.isEnum {
					rawD = append(rawD, *pair.T)
				} else {
					raw = append(raw, *pair.T)
				}

				if pair.D != nil {
					rawD = append(rawD, *pair.D)
				}
			}
		}

		return true
	}
	walk(rootv, visit, nil)

	if len(errors.Errors(terr)) != 0 {
		return nil, terr
	}

	ret := make([]ast.Decl, 0)
	if len(raw) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: []ast.Comment{ts.CommentFromString(fmt.Sprintf("Raw generated types from %s entity type.", cm.Lineage.Name()), 80, false)},
			TypeOnly:    true,
			Exports:     raw,
			From:        ast.Str{Value: fmt.Sprintf("./raw/%s/%s/%s.gen", cm.Lineage.Name(), cm.PathVersion(), cm.Lineage.Name())},
		})
	}
	if len(rawD) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: []ast.Comment{ts.CommentFromString(fmt.Sprintf("Raw generated enums and default consts from %s entity type.", cm.Lineage.Name()), 80, false)},
			TypeOnly:    false,
			Exports:     rawD,
			From:        ast.Str{Value: fmt.Sprintf("./raw/%s/%s/%s.gen", cm.Lineage.Name(), cm.PathVersion(), cm.Lineage.Name())},
		})
	}
	vtfile := fmt.Sprintf("./veneer/%s.types", cm.Lineage.Name())
	customstr := fmt.Sprintf(`// The following exported declarations correspond to types in the %s@%s schema with
// attribute @grafana(TSVeneer="type"). (lineage declared in file: %s)
//
// The handwritten file for these type and default veneers is expected to be at
// %s.ts.
// This re-export declaration enforces that the handwritten veneer file exists,
// and exports all the symbols in the list.
//
// TODO generate code such that tsc enforces type compatibility between raw and veneer decls`,
		cm.Lineage.Name(), thema.LatestVersion(cm.Lineage), cm.RelativePath, filepath.Clean(path.Join("packages", "grafana-schema", "src", vtfile)))

	customComments := []ast.Comment{{Text: customstr}}
	if len(custom) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: customComments,
			TypeOnly:    true,
			Exports:     custom,
			From:        ast.Str{Value: vtfile},
		})
	}
	if len(customD) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: customComments,
			TypeOnly:    false,
			Exports:     customD,
			From:        ast.Str{Value: vtfile},
		})
	}

	// TODO emit a decl in the index.gen.ts that ensures any custom veneer types are "compatible" with current version raw types
	return ret, nil
}

type declPair struct {
	T, D   *ast.Ident
	isEnum bool
}

func findDeclNode(name string, tf *ast.File) declPair {
	var p declPair
	for _, decl := range tf.Nodes {
		// Peer through export keywords
		if ex, is := decl.(ast.ExportKeyword); is {
			decl = ex.Decl
		}

		switch x := decl.(type) {
		case ast.TypeDecl:
			if x.Name.Name == name {
				p.T = &x.Name
				_, p.isEnum = x.Type.(ast.EnumType)
			}
		case ast.VarDecl:
			if x.Names.Idents[0].Name == "default"+name {
				p.D = &x.Names.Idents[0]
			}
		}
	}
	return p
}

type tsVeneerAttr struct {
	target string
}

func walk(v cue.Value, before func(cue.Path, cue.Value) bool, after func(cue.Path, cue.Value)) {
	innerWalk(cue.MakePath(), v, before, after)
}

func innerWalk(p cue.Path, v cue.Value, before func(cue.Path, cue.Value) bool, after func(cue.Path, cue.Value)) {
	// switch v.IncompleteKind() {
	switch v.Kind() {
	default:
		if before != nil && !before(p, v) {
			return
		}
	case cue.StructKind:
		if before != nil && !before(p, v) {
			return
		}
		iter, err := v.Fields(cue.All())
		if err != nil {
			panic(err)
		}

		for iter.Next() {
			innerWalk(appendPath(p, iter.Selector()), iter.Value(), before, after)
		}
		if lv := v.LookupPath(cue.MakePath(cue.AnyString)); lv.Exists() {
			innerWalk(appendPath(p, cue.AnyString), lv, before, after)
		}
	case cue.ListKind:
		if before != nil && !before(p, v) {
			return
		}
		list, err := v.List()
		if err != nil {
			panic(err)
		}
		for i := 0; list.Next(); i++ {
			innerWalk(appendPath(p, cue.Index(i)), list.Value(), before, after)
		}
		if lv := v.LookupPath(cue.MakePath(cue.AnyIndex)); lv.Exists() {
			innerWalk(appendPath(p, cue.AnyString), lv, before, after)
		}
	}
	if after != nil {
		after(p, v)
	}
}

func appendPath(p cue.Path, sel cue.Selector) cue.Path {
	return cue.MakePath(append(p.Selectors(), sel)...)
}

var allowedTSVeneers = map[string]bool{
	"type": true,
}

func allowedTSVeneersString() string {
	var list []string
	for tgt := range allowedTSVeneers {
		list = append(list, tgt)
	}
	sort.Strings(list)

	return strings.Join(list, "|")
}

func getCustomVeneerAttr(v cue.Value) ([]tsVeneerAttr, error) {
	var attrs []tsVeneerAttr
	for _, a := range v.Attributes(cue.ValueAttr) {
		if a.Name() != "grafana" {
			continue
		}
		for i := 0; i < a.NumArgs(); i++ {
			key, av := a.Arg(i)
			if key != "TSVeneer" {
				return nil, valError(v, "attribute 'grafana' only allows the arg 'TSVeneer'")
			}

			aterr := valError(v, "@grafana(TSVeneer=\"x\") requires one or more of the following separated veneer types for x: %s", allowedTSVeneersString())
			var some bool
			for _, tgt := range strings.Split(av, "|") {
				some = true
				if !allowedTSVeneers[tgt] {
					return nil, aterr
				}
				attrs = append(attrs, tsVeneerAttr{
					target: tgt,
				})
			}
			if !some {
				return nil, aterr
			}
		}
	}

	sort.Slice(attrs, func(i, j int) bool {
		return attrs[i].target < attrs[j].target
	})

	return attrs, nil
}

func valError(v cue.Value, format string, args ...interface{}) error {
	s := v.Source()
	if s == nil {
		return fmt.Errorf(format, args...)
	}
	return errors.Newf(s.Pos(), format, args...)
}
