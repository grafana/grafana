package main

import (
	"github.com/urfave/cli/v2"
	"io/ioutil"
	"os"
	"path/filepath"
)

func ExportVersion(c *cli.Context) error {
	metadata, err := GenerateMetadata(c)
	if err != nil {
		return err
	}
	version := metadata.GrafanaVersion

	const distDir = "dist"
	if err := os.RemoveAll(distDir); err != nil {
		return err
	}
	if err := os.Mkdir(distDir, 0775); err != nil {
		return err
	}

	// nolint:gosec
	if err := ioutil.WriteFile(filepath.Join(distDir, "grafana.version"), []byte(version), 0664); err != nil {
		return err
	}

	return nil
}
