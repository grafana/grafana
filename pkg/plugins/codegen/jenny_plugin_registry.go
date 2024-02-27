package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
)

var registryPath = filepath.Join("pkg", "registry", "schemas")

var renamedPlugins = map[string]string{
	"cloud-monitoring":             "googlecloudmonitoring",
	"grafana-pyroscope-datasource": "grafanapyroscope",
}

type PluginRegistryJenny struct {
}

func (jenny *PluginRegistryJenny) JennyName() string {
	return "PluginRegistryJenny"
}

func (jenny *PluginRegistryJenny) Generate(cueFiles []corecodegen.CueSchema) (*codejen.File, error) {
	if len(cueFiles) == 0 {
		return nil, nil
	}
	schemas := make([]Schema, len(cueFiles))
	for i, v := range cueFiles {
		name, err := getSchemaName(v.FilePath)
		if err != nil {
			return nil, fmt.Errorf("unable to find schema name: %s", err)
		}

		schemas[i] = Schema{
			Name:     name,
			Filename: filepath.Base(v.FilePath),
			FilePath: v.FilePath,
		}
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("composable_registry.tmpl").Execute(buf, tmpl_vars_plugin_registry{
		Schemas: schemas,
	}); err != nil {
		return nil, fmt.Errorf("failed executing kind registry template: %w", err)
	}

	return codejen.NewFile(filepath.Join(registryPath, "composable_kind.go"), buf.Bytes(), jenny), nil
}

func getSchemaName(path string) (string, error) {
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return "", fmt.Errorf("path should contain more than 2 elements")
	}
	folderName := parts[len(parts)-2]
	if renamed, ok := renamedPlugins[folderName]; ok {
		folderName = renamed
	}
	folderName = strings.ReplaceAll(folderName, "-", "")
	return strings.ToLower(folderName), nil
}
