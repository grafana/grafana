package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"
)

func Shellcheck(c *cli.Context) error {
	log.Println("Running shellcheck...")

	fpaths := []string{}
	if err := filepath.Walk("scripts", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if strings.HasSuffix(path, ".sh") {
			fpaths = append(fpaths, path)
		}

		return nil
	}); err != nil {
		return fmt.Errorf("couldn't traverse scripts/: %w", err)
	}

	log.Printf("Running shellcheck on %s", strings.Join(fpaths, ","))
	args := append([]string{"-e", "SC1071", "-e", "SC2162"}, fpaths...)
	//nolint:gosec
	cmd := exec.Command("shellcheck", args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("shellcheck failed: %s", output)
	}

	log.Println("Successfully ran shellcheck!")
	return nil
}
