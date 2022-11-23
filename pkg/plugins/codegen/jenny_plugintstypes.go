package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/plugins/codegen/kindsys"
)

func PluginTSTypesJenny(root string, inner codejen.OneToOne[*kindsys.PluginDecl]) codejen.OneToOne[*kindsys.PluginDecl] {
	return &ptsJenny{
		root:  root,
		inner: inner,
	}
}

type ptsJenny struct {
	root  string
	inner codejen.OneToOne[*kindsys.PluginDecl]
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

	f := &tsast.File{}
	f.Doc = &tsast.Comment{
		Text: buf.String(),
	}

	slotname := decl.Slot.Name()
	v := decl.Lineage.Latest().Version()

	f.Nodes = append(f.Nodes, tsast.Raw{
		Data: fmt.Sprintf("export const %sModelVersion = Object.freeze([%v, %v]);", slotname, v[0], v[1]),
	})

	jif, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	f.Nodes = append(f.Nodes, tsast.Raw{
		Data: string(jif.Data),
	})

	path := filepath.Join(j.root, decl.PluginPath, "models.gen.ts")
	body := []byte(f.String())
	body = body[:len(body)-1] // remove the additional line break added by the inner jenny

	return codejen.NewFile(path, body, append(jif.From, j)...), nil
}
