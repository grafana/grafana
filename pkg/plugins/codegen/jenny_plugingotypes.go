package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

func PluginGoTypesJenny(root string, inner codejen.OneToOne[*pfs.PluginDecl]) codejen.OneToOne[*pfs.PluginDecl] {
	return &pgoJenny{
		inner: inner,
		root:  root,
	}
}

type pgoJenny struct {
	inner codejen.OneToOne[*pfs.PluginDecl]
	root  string
}

func (j *pgoJenny) JennyName() string {
	return "PluginGoTypesJenny"
}

func (j *pgoJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	b := decl.PluginMeta.Backend
	if b == nil || !*b {
		return nil, nil
	}

	buf := new(bytes.Buffer)

	if err := tmpls.Lookup("autogen_header.tmpl").Execute(buf, templateVars_autogen_header{
		GeneratorPath:  "public/app/plugins/gen.go", // FIXME hardcoding is not OK
		LineagePath:    filepath.ToSlash(filepath.Join(decl.PluginPath, "models.cue")),
		LineageCUEPath: decl.Slot.Name(),
		GenLicense:     true,
	}); err != nil {
		return nil, fmt.Errorf("error generating file header: %w", err)
	}

	f, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	fmt.Fprint(buf, f.Data)
	f.Data = buf.Bytes()

	pluginfolder := filepath.Base(decl.PluginPath)
	slotname := strings.ToLower(decl.Slot.Name())
	filename := fmt.Sprintf("types_%s_gen.go", slotname)
	f.RelativePath = filepath.Join(j.root, pluginfolder, filename)
	f.From = append(f.From, j)

	return f, nil
}
