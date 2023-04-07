package codegen

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

// PluginSchemaRegistryJenny checks if published schemas are not updated and generates
// ready to be published kind files into the "next" folder of the local schema registry.
func PluginSchemaRegistryJenny(path string) codejen.OneToOne[*pfs.PluginDecl] {
	return &psrJenny{
		path: path,
	}
}

type psrJenny struct {
	path string
}

func (j *psrJenny) JennyName() string {
	return "PluginSchemaRegistryJenny"
}

func (j *psrJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	if !decl.HasSchema() {
		return nil, nil
	}

	name := strings.ToLower(fmt.Sprintf("%s_%s", decl.PluginPath, decl.SchemaInterface.Name()))
	kindPath := filepath.Join("composable", filepath.Dir(decl.PluginPath))
	oldKind, err := corecodegen.GetPublishedKind(name, j.path, kindPath)
	if err != nil {
		return nil, err
	}

	newKindBytes, err := corecodegen.KindToBytes(decl.KindDecl.V)
	if err != nil {
		return nil, err
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil && !thema.IsAppendOnly(oldKind.Lineage(), decl.Lineage) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name+".cue"), newKindBytes, j), nil
}
