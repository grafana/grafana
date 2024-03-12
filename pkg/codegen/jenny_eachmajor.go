package codegen

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
)

// LatestMajorsOrXJenny returns a jenny that repeats the input for the latest in each major version.
//
// TODO remove forceGroup option, it's a temporary hack to accommodate core kinds
func LatestMajorsOrXJenny(parentdir string, inner codejen.OneToOne[SchemaForGen]) OneToMany {
	if inner == nil {
		panic("inner jenny must not be nil")
	}

	return &lmox{
		parentdir: parentdir,
		inner:     inner,
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
