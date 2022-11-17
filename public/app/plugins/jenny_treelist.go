package plugins

import (
	"fmt"

	"github.com/grafana/codejen"
)

func PluginTreeListJenny() codejen.OneToOne[*PluginDecl] {
	return &ptlJenny{}
}

type ptlJenny struct {
}

func (gen *ptlJenny) JennyName() string {
	return "PrintJenny"
}

func (gen *ptlJenny) Generate(decl *PluginDecl) (*codejen.File, error) {
	fmt.Println(decl.Path)
	path := "/Users/marcusandersson/development/go/src/github.com/grafana/grafana/public/app/plugins/test.go"
	return codejen.NewFile(path, []byte{}, gen), nil
}
