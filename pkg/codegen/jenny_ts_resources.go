package codegen

import (
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema/encoding/typescript"
)

// TSResourceJenny is a [OneToOne] that produces TypeScript types and
// defaults for a Thema schema.
//
// Thema's generic TS jenny will be able to replace this one once
// https://github.com/grafana/thema/issues/89 is complete.
type TSResourceJenny struct{}

var _ codejen.OneToOne[SchemaForGen] = &TSResourceJenny{}

func (j TSResourceJenny) JennyName() string {
	return "TSResourceJenny"
}

func (j TSResourceJenny) Generate(sfg SchemaForGen) (*codejen.File, error) {
	// TODO allow using name instead of machine name in thema generator
	f, err := typescript.GenerateTypes(sfg.Schema, &typescript.TypeConfig{
		RootName: sfg.Name,
		Group:    sfg.IsGroup,
		CuetsyConfig: &cuetsy.Config{
			Export:       true,
			ImportMapper: cuectx.MapCUEImportToTS,
		},
	})
	if err != nil {
		return nil, err
	}
	renameSpecNode(sfg.Name, f)

	return codejen.NewFile(sfg.Schema.Lineage().Name()+"_types.gen.ts", []byte(f.String()), j), nil
}

func renameSpecNode(name string, tf *ast.File) {
	specidx, specdefidx := -1, -1
	for idx, def := range tf.Nodes {
		// Peer through export keywords
		if ex, is := def.(ast.ExportKeyword); is {
			def = ex.Decl
		}

		switch x := def.(type) {
		case ast.TypeDecl:
			if x.Name.Name == "spec" {
				specidx = idx
				x.Name.Name = name
				tf.Nodes[idx] = x
			}
		case ast.VarDecl:
			// Before:
			//   export const defaultspec: Partial<spec> = {
			// After:
			///  export const defaultPlaylist: Partial<Playlist> = {
			if x.Names.Idents[0].Name == "defaultspec" {
				specdefidx = idx
				x.Names.Idents[0].Name = "default" + name
				tt := x.Type.(ast.TypeTransformExpr)
				tt.Expr = ts.Ident(name)
				x.Type = tt
				tf.Nodes[idx] = x
			}
		}
	}

	if specidx != -1 {
		decl := tf.Nodes[specidx]
		tf.Nodes = append(append(tf.Nodes[:specidx], tf.Nodes[specidx+1:]...), decl)
	}
	if specdefidx != -1 {
		if specdefidx > specidx {
			specdefidx--
		}
		decl := tf.Nodes[specdefidx]
		tf.Nodes = append(append(tf.Nodes[:specdefidx], tf.Nodes[specdefidx+1:]...), decl)
	}
}
