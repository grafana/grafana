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
			return err
		}

		return cli.Exit(message, 1)
	}

	workspace := c.Args().Get(0)
	verificationErrs, executionErr := verifyStarlark(c.Context, workspace, buildifierLintCommand)
	if executionErr != nil {
		return executionErr
	}

	if len(verificationErrs) == 0 {
		return nil
	}

	noun := "file"
	if len(verificationErrs) > 1 {
		noun += "s"
	}

	return fmt.Errorf("verification failed for %d %s:\n%s",
		len(verificationErrs),
		noun,
		strings.Join(
			mapSlice(verificationErrs, func(e error) string { return e.Error() }),
			"\n",
		))
}

type commandFunc = func(path string) (command string, args []string)

func buildifierLintCommand(path string) (string, []string) {
	return "buildifier", []string{"-lint", "warn", "-mode", "check", path}
}

// verifyStarlark walks all directories starting at provided workspace path and
// verifies any Starlark files it finds.
// Starlark files are assumed to end with the .star extension.
// The verification relies on linting frovided by the 'buildifier' binary which
// must be in the PATH.
// A slice of verification errors are returned, one for each file that failed verification.
// If any execution of the `buildifier` command fails, this is returned separately.
// commandFn is executed on every Starlark file to determine the command and arguments to be executed.
// The caller is trusted and it is the callers responsibility to ensure that the resulting command is safe to execute.
func verifyStarlark(ctx context.Context, workspace string, commandFn commandFunc) ([]error, error) {
	var verificationErrs []error

	// All errors from filepath.WalkDir are filtered by the fs.WalkDirFunc.
	// Lstat or ReadDir errors are reported as verificationErrors.
	// If any execution of the `buildifier` command fails or if the context is cancelled,
	// it is reported as an error and any verification of subsequent files is skipped.
	err := filepath.WalkDir(workspace, func(path string, d fs.DirEntry, err error) error {
		// Skip verification of the file or files within the directory if there is an error
		// returned by Lstat or ReadDir.
		if err != nil {
			verificationErrs = append(verificationErrs, err)
			return nil
		}

		if d.IsDir() {
			return nil
		}

		if filepath.Ext(path) == ".star" {
			command, args := commandFn(path)
			// The caller is trusted.
			//nolint:gosec
			cmd := exec.CommandContext(ctx, command, args...)
			cmd.Dir = workspace

			_, err = cmd.Output()
			if err == nil { // No error, early return.
				return nil
			}

			// The error returned from cmd.Output() is never wrapped.
			//nolint:errorlint
			if err, ok := err.(*exec.ExitError); ok {
				switch err.ExitCode() {
				// Case comments are informed by the output of `buildifier --help`
				case 1: // syntax errors in input
					verificationErrs = append(verificationErrs, errors.New(string(err.Stderr)))
					return nil
				case 2: // usage errors: invoked incorrectly
					return fmt.Errorf("command %q: %s", cmd, err.Stderr)
				case 3: // unexpected runtime errors: file I/O problems or internal bugs
					return fmt.Errorf("command %q: %s", cmd, err.Stderr)
				case 4: // check mode failed (reformat is needed)
					verificationErrs = append(verificationErrs, errors.New(string(err.Stderr)))
					return nil
				default:
					return fmt.Errorf("command %q: %s", cmd, err.Stderr)
				}
			}

			// Error was not an exit error from the command.
			return fmt.Errorf("command %q: %v", cmd, err)
		}

		return nil
	})

	return verificationErrs, err
}
