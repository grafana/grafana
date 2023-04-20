package codegen

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/typescript"
)

// TSResourceJenny is a [OneToOne] that produces TypeScript types and
// defaults for a Thema schema.
//
// Thema's generic TS jenny will be able to replace this one once
// https://github.com/grafana/thema/issues/89 is complete.
type TSResourceJenny struct{}

var _ codejen.OneToMany[kindsys.Kind] = &TSResourceJenny{}

func (j TSResourceJenny) JennyName() string {
	return "TSResourceJenny"
}

// func (j TSResourceJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
// 	// TODO allow using name instead of machine name in thema generator
// 	f, err := typescript.GenerateTypes(sfg.Schema, &typescript.TypeConfig{
// 		RootName: sfg.Name,
// 		Group:    sfg.IsGroup,
// 	})
// 	if err != nil {
// 		return nil, err
// 	}

// 	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_types.gen.ts", []byte(f.String()), j), nil
// }

func (g *TSResourceJenny) Generate(kind kindsys.Kind) (codejen.Files, error) {
	comm := kind.Props().Common()
	sfg := SchemaForGen{
		Name:    comm.Name,
		Schema:  kind.Lineage().Latest(),
		IsGroup: comm.LineageIsGroup,
	}
	sch := sfg.Schema

	// Iterate through all top-level fields and make go types for them
	// (this should consist of "spec" and arbitrary subresources)
	i, err := sch.Underlying().Fields()
	if err != nil {
		return nil, err
	}
	files := make(codejen.Files, 0)
	for i.Next() {
		str := i.Selector().String()

		rootName := sfg.Name
		if str != "spec" {
			rootName += typeNameFromKey(str)
			continue // hack for now
		}

		f, err := themaCuetsyHackGenerateTypes(sfg.Schema, &typescript.TypeConfig{
			RootName: rootName,
			Group:    sfg.IsGroup,
		}, i.Selector())
		if err != nil {
			return nil, err
		}

		name := sfg.Schema.Lineage().Name()
		files = append(files, codejen.File{
			//RelativePath: fmt.Sprintf("packages/grafana-schema/src/raw/%s/x/%s_%s_types.gen.ts", name, name, strings.ToLower(str)),
			RelativePath: fmt.Sprintf("packages/grafana-schema/src/raw/%s/x/%s_types.gen.ts", name, name),
			Data:         []byte(f.String()),
			From:         []codejen.NamedJenny{g},
		})
	}

	return files, nil
}

// Should be updated upstream...
func themaCuetsyHackGenerateTypes(sch thema.Schema, cfg *typescript.TypeConfig, subpath cue.Selector) (*ast.File, error) {
	if cfg == nil {
		cfg = new(typescript.TypeConfig)
	}
	if cfg.CuetsyConfig == nil {
		cfg.CuetsyConfig = &cuetsy.Config{
			Export: true,
		}
	}
	if cfg.RootName == "" {
		cfg.RootName = strings.Title(sch.Lineage().Name())
	}

	schval := sch.Underlying().LookupPath(cue.MakePath(subpath))

	tf, err := cuetsy.GenerateAST(schval, *cfg.CuetsyConfig)
	if err != nil {
		return nil, fmt.Errorf("generating TS for child elements of schema failed: %w", err)
	}

	if !cfg.Group {
		as := cuetsy.TypeInterface
		if cfg.RootAsType {
			as = cuetsy.TypeAlias
		}
		top, err := cuetsy.GenerateSingleAST(cfg.RootName, schval, as)
		if err != nil {
			return nil, fmt.Errorf("generating TS for schema root failed: %w", err)
		}
		tf.Nodes = append(tf.Nodes, top.T)
		if top.D != nil {
			tf.Nodes = append(tf.Nodes, top.D)
		}
	}

	return tf, nil
}
