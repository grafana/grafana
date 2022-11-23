package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/codegen/kindsys"
)

func PluginTSTypesJenny(root string, inner codejen.OneToOne[*kindsys.PluginDecl]) codejen.OneToOne[*kindsys.PluginDecl] {
	return &ptsJenny{
		root:  root,
		inner: inner,
	}
}

type ptsJenny struct {
	fileName string
	root     string
	inner    codejen.OneToOne[*kindsys.PluginDecl]
}

func (j *ptsJenny) JennyName() string {
	return "PluginTSTypesJenny"
}

func (j *ptsJenny) Generate(decl *kindsys.PluginDecl) (*codejen.File, error) {
	tf := templateVars_autogen_header{
		GeneratorPath: "public/app/plugins/gen.go", // FIXME hardcoding is not OK
		LineagePath:   "models.cue",                // FIXME hardcosing is not OK
	}

	var buf bytes.Buffer
	err := tmpls.Lookup("autogen_header.tmpl").Execute(&buf, tf)
	if err != nil {
		return nil, fmt.Errorf("error executing header template: %w", err)
	}

	f, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	f.Data = append(buf.Bytes(), f.Data...)
	f.RelativePath = filepath.Join(j.root, decl.PluginPath, "models.gen.ts")
	f.From = append(f.From, j)
	return f, nil
}
