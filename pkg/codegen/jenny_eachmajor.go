package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy/ts"
	"github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/kindsys"
)

// LatestMajorsOrXJenny returns a jenny that repeats the input for the latest in each major version.
func LatestMajorsOrXJenny(parentdir string) OneToMany {
	return &lmox{
		parentdir: parentdir,
		inner:     TSTypesJenny{ApplyFuncs: []ApplyFunc{renameSpecNode}},
	}
}

type lmox struct {
	parentdir string
	inner     codejen.OneToOne[SchemaForGen]
}

func (j *lmox) JennyName() string {
	return "LatestMajorsOrXJenny"
}

func (j *lmox) Generate(kind kindsys.Kind) (codejen.Files, error) {
	// TODO remove this once codejen catches nils https://github.com/grafana/codejen/issues/5
	if kind == nil {
		return nil, nil
	}

	comm := kind.Props().Common()
	sfg := SchemaForGen{
		Name:    comm.Name,
		IsGroup: true,
		Schema:  kind.Lineage().Latest(),
	}

	f, err := j.inner.Generate(sfg)
	if err != nil {
		return nil, fmt.Errorf("%s jenny failed on %s schema for %s: %w", j.inner.JennyName(), sfg.Schema.Version(), kind.Props().Common().Name, err)
	}
	if f == nil || !f.Exists() {
		return nil, nil
	}

	f.RelativePath = filepath.Join(j.parentdir, comm.MachineName, "x", f.RelativePath)
	f.From = append(f.From, j)
	return codejen.Files{*f}, nil
}

// renameSpecNode rename spec node from the TS file result
func renameSpecNode(sfg SchemaForGen, tf *ast.File) {
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
				x.Name.Name = sfg.Name
				tf.Nodes[idx] = x
			}
		case ast.VarDecl:
			// Before:
			//   export const defaultspec: Partial<spec> = {
			// After:
			// /  export const defaultPlaylist: Partial<Playlist> = {
			if x.Names.Idents[0].Name == "defaultspec" {
				specdefidx = idx
				x.Names.Idents[0].Name = "default" + sfg.Name
				tt := x.Type.(ast.TypeTransformExpr)
				tt.Expr = ts.Ident(sfg.Name)
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
