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

// VerifyStarlark is the CLI Action for verifying Starlark files in a workspace.
// It expects a single context argument which is the path to the workspace.
// The actual verification procedure can return multiple errors which are
// joined together to be one holistic error for the action.
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

// verifyStarlark walks all directories starting at provided workspace path and
// verifies any Starlark files it finds.
// Starlark files are assumed to end with the .star extension.
// The verification relies on linting frovided by the 'buildifier' binary which
// must be in the PATH.
func verifyStarlark(ctx context.Context, workspace string) []error {
	var errs []error

	// All errors from filepath.WalkDir are filtered by the fs.WalkDirFunc.
	// The anonymous function used here never returns an error.
	if err := filepath.WalkDir(workspace, func(path string, d fs.DirEntry, err error) error {
		// Skip verification of the file or files within the directory if there is an error
		// returned by Lstat or ReadDir.
		// Report the Lstat or ReadDir error as part of errs.
		if err != nil {
			errs = append(errs, err)
			return nil
		}

		if d.IsDir() {
			return nil
		}

		if filepath.Ext(path) == ".star" {
			cmd := exec.CommandContext(ctx, "buildifier", "-lint", "warn", path)
			cmd.Dir = workspace

			output, err := cmd.CombinedOutput()
			if err == nil { // No error, early return.
				return nil
			}

			var exitError *exec.ExitError
			if errors.As(err, &exitError) {
				switch err.(*exec.ExitError).ExitCode() {
				// Case comments are informed by the output of `buildifier --help`
				case 1: // syntax errors in input
					errs = append(errs, fmt.Errorf("command %q: unexpected syntax error in input: %s", cmd, string(output)))
					return nil
				case 2: // usage errors: invoked incorrectly
					errs = append(errs, fmt.Errorf("command %q: usage error: %s", cmd, string(output)))
					return nil
				case 3: // unexpected runtime errors: file I/O problems or internal bugs
					errs = append(errs, fmt.Errorf("command %q: runtime error: %s", cmd, string(output)))
					return nil
				case 4: // check mode failed (reformat is needed)
					errs = append(errs, errors.New(string(output)))
					return nil
				}
			}

			// Error was either an *exec.exitError with an unexpected exit code or
			// a different error entirely.
			errs = append(errs, fmt.Errorf("command %q: unexpected error: %v", cmd, err))
			return nil
		}

		return nil
	}); err != nil {
		panic(fmt.Sprintf("unexpected error from filepath.WalkDir: %v", err))
	}

	return errs
}
