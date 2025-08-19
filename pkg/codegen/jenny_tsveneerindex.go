package codegen

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/codegen/generators"
)

// TSVeneerIndexJenny generates an index.gen.ts file with references to all
// generated TS types. Elements with the attribute @grafana(TSVeneer="type") are
// exported from a handwritten file, rather than the raw generated types.
//
// The provided dir is the path, relative to the grafana root, to the directory
// that should contain the generated index.
//
// Implicitly depends on output patterns in TSTypesJenny.
// TODO this is wasteful; share-nothing generator model entails re-running the cuetsy gen that TSTypesJenny already did
func TSVeneerIndexJenny(dir string) ManyToOne {
	return &genTSVeneerIndex{
		dir: dir,
	}
}

type genTSVeneerIndex struct {
	dir string
}

func (gen *genTSVeneerIndex) JennyName() string {
	return "TSVeneerIndexJenny"
}

func (gen *genTSVeneerIndex) Generate(sfg ...SchemaForGen) (*codejen.File, error) {
	tsf := new(ast.File)
	for _, def := range sfg {
		f, err := generators.GenerateTypesTS(def.CueFile, &generators.TSConfig{
			CuetsyConfig: &cuetsy.Config{
				ImportMapper: MapCUEImportToTS,
			},
			RootName: def.Name,
			IsGroup:  def.IsGroup,
		})
		if err != nil {
			return nil, fmt.Errorf("%s: %w", def.Name, err)
		}
		// The obvious approach would be calling renameSpecNode() here, same as in the ts resource jenny,
		// to rename the "spec" field to the name of the kind. But that was causing extra
		// default elements to generate that didn't actually exist. Instead,
		// findDeclNode() is aware of "spec" and does the change on the fly. Preserving this
		// as a reminder in case we want to switch back, though.
		// renameSpecNode(def.Props().Common().Name, f)

		elems, err := gen.extractTSIndexVeneerElements(def, f)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", def.Name, err)
		}
		tsf.Nodes = append(tsf.Nodes, elems...)
	}

	return codejen.NewFile(filepath.Join(gen.dir, "index.gen.ts"), []byte(tsf.String()), gen), nil
}

func (gen *genTSVeneerIndex) extractTSIndexVeneerElements(def SchemaForGen, tf *ast.File) ([]ast.Decl, error) {
	// Check the root, then walk the tree
	rootv := def.CueFile.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))

	var raw, custom, rawD, customD ast.Idents

	var terr errors.Error
	visit := func(p cue.Path, wv cue.Value) bool {
		var name string
		sels := p.Selectors()
		switch len(sels) {
		case 0:
			return true

		case 1:
			// Only deal with subpaths that are definitions, for now
			// TODO incorporate smarts about grouped lineages here
			if name == "" {
				if !sels[0].IsDefinition() && sels[0].String() != "spec" {
					return false
				}
				// It might seem to make sense that we'd strip out the leading # here for
				// definitions. However, cuetsy's tsast actually has the # still present in its
				// Ident types, stripping it out on the fly when stringifying.
				name = sels[0].String()
			}

			// Search the generated TS AST for the type and default def nodes
			pair := findDeclNode(name, def.Name, tf)
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

	vpath := "x"
	machineName := strings.ToLower(def.Name)

	ret := make([]ast.Decl, 0)
	if len(raw) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: []ast.Comment{ts.CommentFromString(fmt.Sprintf("Raw generated types from %s kind.", def.Name), 80, false)},
			TypeOnly:    true,
			Exports:     raw,
			From:        ast.Str{Value: fmt.Sprintf("./raw/%s/%s/%s_types.gen", machineName, vpath, machineName)},
		})
	}
	if len(rawD) > 0 {
		ret = append(ret, ast.ExportSet{
			CommentList: []ast.Comment{ts.CommentFromString(fmt.Sprintf("Raw generated enums and default consts from %s kind.", machineName), 80, false)},
			TypeOnly:    false,
			Exports:     rawD,
			From:        ast.Str{Value: fmt.Sprintf("./raw/%s/%s/%s_types.gen", machineName, vpath, machineName)},
		})
	}
	vtfile := fmt.Sprintf("./veneer/%s.types", machineName)
	version, err := getVersion(def.CueFile)
	if err != nil {
		return nil, err
	}

	customstr := fmt.Sprintf(`// The following exported declarations correspond to types in the %s@%s kind's
// schema with attribute @grafana(TSVeneer="type").
//
// The handwritten file for these type and default veneers is expected to be at
// %s.ts.
// This re-export declaration enforces that the handwritten veneer file exists,
// and exports all the symbols in the list.
//
// TODO generate code such that tsc enforces type compatibility between raw and veneer decls`,
		machineName, strings.ReplaceAll(version, "-", "."), filepath.ToSlash(filepath.Join(gen.dir, vtfile)))

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

	// TODO emit a def in the index.gen.ts that ensures any custom veneer types are "compatible" with current version raw types
	return ret, nil
}

type declPair struct {
	T, D   *ast.Ident
	isEnum bool
}

type tsVeneerAttr struct {
	target string
}

func findDeclNode(name, basename string, tf *ast.File) declPair {
	var p declPair

	if name == basename {
		return declPair{}
	}

	for _, def := range tf.Nodes {
		// Peer through export keywords
		if ex, is := def.(ast.ExportKeyword); is {
			def = ex.Decl
		}

		switch x := def.(type) {
		case ast.TypeDecl:
			if x.Name.Name == name {
				p.T = &x.Name
				_, p.isEnum = x.Type.(ast.EnumType)
				if name == "spec" {
					p.T.Name = basename
				}
			}
		case ast.VarDecl:
			if x.Names.Idents[0].Name == "default"+name {
				p.D = &x.Idents[0]
				if name == "spec" {
					p.D.Name = "default" + basename
				}
			}
		}
	}
	return p
}

func walk(v cue.Value, before func(cue.Path, cue.Value) bool, after func(cue.Path, cue.Value)) {
	innerWalk(cue.MakePath(), v, before, after)
}

func innerWalk(p cue.Path, v cue.Value, before func(cue.Path, cue.Value) bool, after func(cue.Path, cue.Value)) {
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

var allowedTSVeneers = map[string]bool{
	"type": true,
}

func allowedTSVeneersString() string {
	list := make([]string, 0, len(allowedTSVeneers))
	for tgt := range allowedTSVeneers {
		list = append(list, tgt)
	}
	sort.Strings(list)

	return strings.Join(list, "|")
}

func valError(v cue.Value, format string, args ...any) error {
	s := v.Source()
	if s == nil {
		return fmt.Errorf(format, args...)
	}
	return errors.Newf(s.Pos(), format, args...)
}
