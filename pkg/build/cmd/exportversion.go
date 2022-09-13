package main

import (
	"os"
	"path/filepath"

	"github.com/urfave/cli/v2"
)

func ExportVersion(c *cli.Context) error {
	metadata, err := GenerateMetadata(c)
	if err != nil {
		return err
	}

	const distDir = "dist"
	if err := os.RemoveAll(distDir); err != nil {
		return err
	}
	if err := os.Mkdir(distDir, 0750); err != nil {
		return err
	}

	// nolint:gosec
	if err := os.WriteFile(filepath.Join(distDir, "grafana.version"), []byte(metadata.GrafanaVersion), 0664); err != nil {
		return err
	}

	return nil
}
