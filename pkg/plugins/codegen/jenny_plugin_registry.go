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

var renamedPlugins = map[string]string{
	"cloud-monitoring":             "googlecloudmonitoring",
	"grafana-pyroscope-datasource": "grafanapyroscope",
	"annolist":                     "annotationslist",
	"grafanatestdatadatasource":    "testdata",
	"dashlist":                     "dashboardlist",
}

type PluginRegistryJenny struct {
}

func (jenny *PluginRegistryJenny) JennyName() string {
	return "PluginRegistryJenny"
}

func (jenny *PluginRegistryJenny) Generate(files []string) (*codejen.File, error) {
	if len(files) == 0 {
		return nil, nil
	}
	schemas := make([]Schema, len(files))
	for i, file := range files {
		name, err := getSchemaName(file)
		if err != nil {
			return nil, fmt.Errorf("unable to find schema name: %s", err)
		}

		schemas[i] = Schema{
			Name:     name,
			Filename: filepath.Base(file),
			FilePath: file,
		}
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("composable_registry.tmpl").Execute(buf, tmpl_vars_plugin_registry{
		Schemas: schemas,
	}); err != nil {
		return nil, fmt.Errorf("failed executing kind registry template: %w", err)
	}

	b, err := format.Source(buf.Bytes())
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(filepath.Join(registryPath, "composable_kind.go"), b, jenny), nil
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
