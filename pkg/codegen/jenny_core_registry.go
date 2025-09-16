package codegen

import (
	"bytes"
	"fmt"
	"go/format"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
)

var registryPath = filepath.Join("pkg", "registry", "schemas")

// CoreRegistryJenny generates a registry with all core kinds.
type CoreRegistryJenny struct {
}

func (jenny *CoreRegistryJenny) JennyName() string {
	return "CoreRegistryJenny"
}

func (jenny *CoreRegistryJenny) Generate(cueFiles ...SchemaForGen) (codejen.Files, error) {
	schemas := make([]Schema, len(cueFiles))
	for i, v := range cueFiles {
		name, err := getSchemaName(v.Name)
		if err != nil {
			return nil, err
		}

		schemas[i] = Schema{
			Name:     name,
			FilePath: v.FilePath,
		}
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_registry.tmpl").Execute(buf, tvars_registry{
		Schemas: schemas,
	}); err != nil {
		return nil, fmt.Errorf("failed executing kind registry template: %w", err)
	}

	b, err := format.Source(buf.Bytes())
	if err != nil {
		return nil, err
	}

	file := codejen.NewFile(filepath.Join(registryPath, "core_kind.go"), b, jenny)
	return codejen.Files{*file}, nil
}

func getSchemaName(pkg string) (string, error) {
	pkg = strings.ReplaceAll(pkg, "-", "_")
	return strings.ToLower(pkg), nil
}
