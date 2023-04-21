package codegen

import (
	"fmt"
	"path/filepath"
	"strings"

	copenapi "cuelang.org/go/encoding/openapi"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema/encoding/gocode"
	"github.com/grafana/thema/encoding/openapi"
)

// TODO this is duplicative of other Go type jennies. Remove it in favor of a better-abstracted version in thema itself
func PluginGoTypesJenny(root string) codejen.OneToOne[*pfs.PluginDecl] {
	return &pgoJenny{
		root: root,
	}
}

type pgoJenny struct {
	root string
}

func (j *pgoJenny) JennyName() string {
	return "PluginGoTypesJenny"
}

func (j *pgoJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	b := decl.PluginMeta.Backend
	if b == nil || !*b || !decl.HasSchema() {
		return nil, nil
	}

	slotname := strings.ToLower(decl.SchemaInterface.Name())
	byt, err := gocode.GenerateTypesOpenAPI(decl.Lineage.Latest(), &gocode.TypeConfigOpenAPI{
		Config: &openapi.Config{
			Group: decl.SchemaInterface.IsGroup(),
			Config: &copenapi.Config{
				ExpandReferences: true,
				MaxCycleDepth:    10,
			},
		},
		PackageName: slotname,
		ApplyFuncs:  []dstutil.ApplyFunc{corecodegen.PrefixDropper(decl.Lineage.Name())},
	})
	if err != nil {
		return nil, err
	}

	pluginfolder := filepath.Base(decl.PluginPath)
	// hardcoded exception for testdata datasource, ONLY because "testdata" is basically a
	// language-reserved keyword for Go
	if pluginfolder == "testdata" {
		pluginfolder = "testdatasource"
	}
	filename := fmt.Sprintf("types_%s_gen.go", slotname)
	return codejen.NewFile(filepath.Join(j.root, pluginfolder, "kinds", slotname, filename), byt, j), nil
}
