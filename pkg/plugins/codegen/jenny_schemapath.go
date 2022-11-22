package codegen

import (
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/codegen/kindsys"
)

func UseSchemaPathJenny(root string, fileName string, inner codejen.OneToOne[*kindsys.PluginDecl]) codejen.OneToOne[*kindsys.PluginDecl] {
	return &uspJenny{
		fileName: fileName,
		root:     root,
		inner:    inner,
	}
}

type uspJenny struct {
	fileName string
	root     string
	inner    codejen.OneToOne[*kindsys.PluginDecl]
}

func (j *uspJenny) JennyName() string {
	return "UseSchemaPathJenny"
}

func (j *uspJenny) Generate(decl *kindsys.PluginDecl) (*codejen.File, error) {
	f, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}
	f.RelativePath = filepath.Join(j.root, decl.PluginPath, j.fileName)
	f.From = append(f.From, j)
	return f, nil
}
