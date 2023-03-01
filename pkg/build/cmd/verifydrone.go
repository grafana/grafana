package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/drone/drone-cli/drone/lint"
	"github.com/drone/drone-cli/drone/starlark"
	"github.com/google/go-cmp/cmp"
	cliv1 "github.com/urfave/cli"
	"github.com/urfave/cli/v2"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/build/fsutil"
)

func VerifyDrone(c *cli.Context) error {
	const yml = ".drone.yml"
	const backup = ".drone.yml.bak"

	if err := fsutil.CopyFile(yml, backup); err != nil {
		return cli.Exit(fmt.Sprintf("failed to copy %s to %s: %s", yml, backup, err), 1)
	}
	defer func() {
		if err := os.Remove(yml); err != nil {
			log.Printf("Failed to rename %s to %s", backup, yml)
		}
		if err := os.Rename(backup, yml); err != nil {
			log.Printf("Failed to rename %s to %s", backup, yml)
		}
	}()

	flags := &flag.FlagSet{}
	for _, flag := range starlark.Command.Flags {
		flag.Apply(flags)
	}
	if err := flags.Set("format", "true"); err != nil {
		return err
	}
	cStarlark := cliv1.NewContext(cliv1.NewApp(), flags, nil)
	action := starlark.Command.Action.(func(*cliv1.Context))
	action(cStarlark)

	if err := verifyYAML(yml, backup); err != nil {
		return err
	}

	flags = &flag.FlagSet{}
	for _, flag := range lint.Command.Flags {
		flag.Apply(flags)
	}
	err := flags.Set("trusted", "true")
	if err != nil {
		return err
	}
	cLint := cliv1.NewContext(cliv1.NewApp(), flags, nil)
	actionE := lint.Command.Action.(func(*cliv1.Context) error)
	if err := actionE(cLint); err != nil {
		return err
	}

	log.Printf("%s is valid", yml)

	return nil
}

func readConfig(fpath string) ([]map[string]interface{}, error) {
	//nolint:gosec
	f, err := os.Open(fpath)
	if err != nil {
		return nil, cli.Exit(fmt.Sprintf("failed to read %s: %s", fpath, err), 1)
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Println("error closing file", err)
		}
	}()

	// The YAML stream may contain multiple pipeline configurations, read them all
	dec := yaml.NewDecoder(f)
	var c []map[string]interface{}
	for {
		var m map[string]interface{}
		if err := dec.Decode(&m); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, cli.Exit(fmt.Sprintf("Failed to decode %s: %s", fpath, err), 1)
		}

		if m["kind"] == "signature" {
			log.Printf("Ignoring a signature")
			continue
		}

		c = append(c, m)
	}

	return c, nil
}

func verifyYAML(yml, backup string) error {
	log.Printf("Comparing %s and %s", yml, backup)

	c1, err := readConfig(yml)
	if err != nil {
		return err
	}

	c2, err := readConfig(backup)
	if err != nil {
		return err
	}

	if !cmp.Equal(c1, c2) {
		return cli.Exit(fmt.Sprintf("%s is out of sync with .drone.star - regenerate it with drone starlark convert",
			yml), 1)
	}

	return nil
}
