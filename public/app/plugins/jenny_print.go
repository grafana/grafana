package plugins

import (
	"fmt"

	"github.com/grafana/codejen"
)

func PrintJenny() codejen.OneToOne[*PluginDecl] {
	return &printJenny{}
}

type printJenny struct {
}

func (gen *printJenny) JennyName() string {
	return "PrintJenny"
}

func (gen *printJenny) Generate(decl *PluginDecl) (*codejen.File, error) {
	fmt.Println(decl.Path)
	path := "/Users/marcusandersson/development/go/src/github.com/grafana/grafana/public/app/plugins/test.go"
	return codejen.NewFile(path, []byte{}, gen), nil
}
