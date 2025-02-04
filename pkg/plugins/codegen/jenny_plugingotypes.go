package codegen

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
	"github.com/grafana/cog"
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
	if hasBackend == nil || !*hasBackend {
		return nil, nil
	}

	slotName := strings.ToLower(decl.SchemaInterface.Name)
	cueValue := decl.CueFile.LookupPath(cue.ParsePath("lineage.schemas[0].schema"))
	name, err := decl.CueFile.LookupPath(cue.MakePath(cue.Str("name"))).String()
	if err != nil {
		return nil, err
	}

	byt, err := cog.TypesFromSchema().
		CUEValue(slotName, cueValue, cog.ForceEnvelope(name)).
		Golang(cog.GoConfig{}).
		Run(context.Background())

	if err != nil {
		return nil, err
	}

	pluginfolder := filepath.Base(decl.PluginPath)
	// hardcoded exception for testdata datasource, ONLY because "testdata" is basically a
	// language-reserved keyword for Go
	if pluginfolder == "testdata" {
		pluginfolder = "testdatasource"
	}
	filename := fmt.Sprintf("types_%s_gen.go", slotName)
	return codejen.NewFile(filepath.Join(j.root, pluginfolder, "kinds", slotName, filename), byt[0].Data, j), nil
}
