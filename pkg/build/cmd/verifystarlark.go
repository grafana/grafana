package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"
)

func mapSlice[I any, O any](a []I, f func(I) O) []O {
	o := make([]O, len(a))
	for i, e := range a {
		o[i] = f(e)
	}
	return o
}

func VerifyStarlark(c *cli.Context) error {
	if c.NArg() != 1 {
		var message string
		if c.NArg() == 0 {
			message = "ERROR: missing required argument <workspace path>"
		}
		if c.NArg() > 1 {
			message = "ERROR: too many arguments"
		}

		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit(message, 1)
	}

	workspace := c.Args().Get(0)
	errs := verifyStarlark(c.Context, workspace)
	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("%d errors occurred:\n%s",
		len(errs),
		strings.Join(
			mapSlice(errs, func(e error) string { return e.Error() }),
			"\n",
		))
}

func verifyStarlark(ctx context.Context, workspace string) []error {
	var errs []error

	_ = filepath.WalkDir(workspace, func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			return nil
		}

		if filepath.Ext(path) == ".star" {
			cmd := exec.CommandContext(ctx, "buildifier", "-lint", "warn", path)
			cmd.Dir = workspace
			output, err := cmd.CombinedOutput()
			if err != nil {
				switch err.Error() {
				case "exit status 1": // syntax errors in input
					errs = append(errs, fmt.Errorf("unexpected syntax error from command %q: %s", cmd, string(output)))
				case "exit status 2": // usage errors: invoked incorrectly
					errs = append(errs, fmt.Errorf("unexpected usage error from command %q: %s", cmd, string(output)))
				case "exit status 3": // unexpected runtime errors: file I/O problems or internal bugs
					errs = append(errs, fmt.Errorf("unexpected runtime error from command %q: %s", cmd, string(output)))
				case "exit status 4": // check mode failed (reformat is needed)
					errs = append(errs, errors.New(string(output)))
				default:
					errs = append(errs, fmt.Errorf("unexpected error from command %q: %v", cmd, err))
				}
			}
		}

		return nil
	})

	return errs
}
