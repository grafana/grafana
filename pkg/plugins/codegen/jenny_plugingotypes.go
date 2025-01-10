package codegen

import (
	"fmt"
	"path/filepath"
	"strings"

	copenapi "cuelang.org/go/encoding/openapi"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen/generators"
	"github.com/grafana/grafana/pkg/plugins/codegen/pfs"
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
	hasBackend := decl.PluginMeta.Backend
	// We skip elasticsearch since we have problems with the generated file.
	// This is temporal until we migrate to the new system.
	if hasBackend == nil || !*hasBackend || decl.PluginMeta.Id == "elasticsearch" {
		return nil, nil
	}

	slotname := strings.ToLower(decl.SchemaInterface.Name)
	byt, err := generators.GenerateTypesGo(decl.CueFile, &generators.GoConfig{
		Config: &generators.OpenApiConfig{
			Config: &copenapi.Config{
				MaxCycleDepth: 10,
			},
			IsGroup: decl.SchemaInterface.IsGroup,
		},
		PackageName: slotname,
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
