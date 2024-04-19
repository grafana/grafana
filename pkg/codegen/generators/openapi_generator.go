package generators

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/encoding/openapi"
)

type OpenApiConfig struct {
	Config   *openapi.Config
	IsGroup  bool
	RootName string
	SubPath  cue.Path
}

func generateOpenAPI(v cue.Value, cfg *OpenApiConfig) (*ast.File, error) {
	if cfg == nil {
		return nil, fmt.Errorf("missing openapi configuration")
	}

	if cfg.Config == nil {
		cfg.Config = &openapi.Config{}
	}

	name, err := getSchemaName(v)
	if err != nil {
		return nil, err
	}

	gen := &oapiGen{
		cfg:     cfg,
		name:    name,
		val:     v.LookupPath(cue.ParsePath("lineage.schemas[0].schema")),
		subpath: cfg.SubPath,
		bpath:   v.LookupPath(cue.ParsePath("lineage.schemas[0]")).Path(),
	}

	declFunc := genSchema
	if cfg.IsGroup {
		declFunc = genGroup
	}

	decls, err := declFunc(gen)

	if err != nil {
		return nil, err
	}

	// TODO recursively sort output to improve stability of output
	return &ast.File{
		Decls: []ast.Decl{
			ast.NewStruct(
				"openapi", ast.NewString("3.0.0"),
				"paths", ast.NewStruct(),
				"components", ast.NewStruct(
					"schemas", &ast.StructLit{Elts: decls},
				),
			),
		},
	}, nil
}

type oapiGen struct {
	cfg     *OpenApiConfig
	val     cue.Value
	subpath cue.Path

	// overall name for the generated oapi doc
	name string

	// original NameFunc
	onf func(cue.Value, cue.Path) string

	// full prefix path that leads up to the #SchemaDef, e.g. lin._sortedSchemas[0]
	bpath cue.Path
}

func genGroup(gen *oapiGen) ([]ast.Decl, error) {
	ctx := gen.val.Context()
	iter, err := gen.val.Fields(cue.Definitions(true), cue.Optional(true))
	if err != nil {
		panic(fmt.Errorf("unreachable - should always be able to get iter for struct kinds: %w", err))
	}

	var decls []ast.Decl
	for iter.Next() {
		val, sel := iter.Value(), iter.Selector()
		name := strings.Trim(sel.String(), "?#")

		v := ctx.CompileString(fmt.Sprintf("#%s: _", name))
		defpath := cue.MakePath(cue.Def(name))
		defsch := v.FillPath(defpath, val)

		cfgi := *gen.cfg.Config
		cfgi.NameFunc = func(val cue.Value, path cue.Path) string {
			return gen.nfSingle(val, path, defpath, name)
		}

		part, err := openapi.Generate(defsch, &cfgi)
		if err != nil {
			return nil, fmt.Errorf("failed generation for grouped field %s: %w", sel, err)
		}

		decls = append(decls, getSchemas(part)...)
	}

	return decls, nil
}

func genSchema(gen *oapiGen) ([]ast.Decl, error) {
	hasSubpath := len(gen.cfg.SubPath.Selectors()) > 0
	name := sanitizeLabelString(gen.name)
	if gen.cfg.RootName != "" {
		name = gen.cfg.RootName
	} else if hasSubpath {
		sel := gen.cfg.SubPath.Selectors()
		name = sel[len(sel)-1].String()
	}

	val := gen.val
	if hasSubpath {
		for i, sel := range gen.cfg.SubPath.Selectors() {
			if !gen.val.Allows(sel) {
				return nil, fmt.Errorf("subpath %q not present in schema", cue.MakePath(gen.cfg.SubPath.Selectors()[:i+1]...))
			}
		}
		val = val.LookupPath(gen.cfg.SubPath)
	}

	v := gen.val.Context().CompileString(fmt.Sprintf("#%s: _", name))
	defpath := cue.MakePath(cue.Def(name))
	defsch := v.FillPath(defpath, val)

	gen.cfg.Config.NameFunc = func(val cue.Value, path cue.Path) string {
		return gen.nfSingle(val, path, defpath, name)
	}

	f, err := openapi.Generate(defsch.Eval(), gen.cfg.Config)
	if err != nil {
		return nil, err
	}

	return getSchemas(f), nil
}

// For generating a single, our NameFunc must:
// - Eliminate any path prefixes on the element, both internal lineage and wrapping
// - Replace the name "_#schema" with the desired name
// - Call the user-provided NameFunc, if any
// - Remove CUE markers like #, !, ?
func (gen *oapiGen) nfSingle(val cue.Value, path, defpath cue.Path, name string) string {
	tpath := trimPathPrefix(trimThemaPathPrefix(path, gen.bpath), defpath)

	if path.String() == "" || tpath.String() == defpath.String() {
		return name
	}

	if val == gen.val {
		return ""
	}

	if gen.onf != nil {
		return gen.onf(val, tpath)
	}
	return strings.Trim(tpath.String(), "?#")
}

func getSchemas(f *ast.File) []ast.Decl {
	compos := orp(getFieldByLabel(f, "components"))
	schemas := orp(getFieldByLabel(compos.Value, "schemas"))
	return schemas.Value.(*ast.StructLit).Elts
}

func orp[T any](t T, err error) T {
	if err != nil {
		panic(err)
	}
	return t
}

func trimThemaPathPrefix(p, base cue.Path) cue.Path {
	if !pathHasPrefix(p, base) {
		return p
	}

	rest := p.Selectors()[len(base.Selectors()):]
	if len(rest) == 0 {
		return cue.Path{}
	}
	switch rest[0].String() {
	case "schema", "_#schema", "_join", "joinSchema":
		return cue.MakePath(rest[1:]...)
	default:
		return cue.MakePath(rest...)
	}
}
