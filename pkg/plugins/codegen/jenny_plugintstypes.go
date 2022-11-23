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

	tsf := &tsast.File{}
	tsf.Doc = &tsast.Comment{
		Text: buf.String(),
	}

	for _, im := range decl.Imports {
		if tsim, err := convertImport(im); err != nil {
			return nil, err
		} else if tsim.From.Value != "" {
			tsf.Imports = append(tsf.Imports, tsim)
		}
	}

	slotname := decl.Slot.Name()
	v := decl.Lineage.Latest().Version()

	tsf.Nodes = append(tsf.Nodes, tsast.Raw{
		Data: fmt.Sprintf("export const %sModelVersion = Object.freeze([%v, %v]);", slotname, v[0], v[1]),
	})

	jf, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	tsf.Nodes = append(tsf.Nodes, tsast.Raw{
		Data: string(jf.Data),
	})

	path := filepath.Join(j.root, decl.PluginPath, "models.gen.ts")
	body := []byte(tsf.String())
	body = body[:len(body)-1] // remove the additional line break added by the inner jenny

	return codejen.NewFile(path, body, append(jf.From, j)...), nil
}
