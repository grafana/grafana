package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/sdboyer/cuetsy/encoder"
)

type attrTSTarget string

func (cmd Command) generateDashboardTypeScripts(c utils.CommandLine) error {
	dest := c.String("dest")

	if err := generateTypeScriptFromCUE(dest, paths); err != nil {
		return err
	}

	return nil
}

func generateTypeScriptFromCUE(dest string, p load.BaseLoadPaths) error {
	panelSchemaMap, err := load.ReadPanelModels(p)
	if err != nil {
		return err
	}

	for panelName, panelSchema := range panelSchemaMap {
		b, err := encoder.Generate(panelSchema.CUE(), encoder.Config{})
		if err != nil {
			return err
		}
		writeTypeScriptFiles(filepath.Join(dest, panelName+".ts"), string(b))
	}
	return nil
}

func writeTypeScriptFiles(dest string, content string) error {
	fd, err := os.Create(dest)
	if err != nil {
		return err
	}
	fmt.Fprint(fd, content)
	return nil
}
