package main

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerifyStarlark(t *testing.T) {
	t.Run("a single file with lint", func(t *testing.T) {
		ctx := context.Background()
		workspace := t.TempDir()

		invalidContent := []byte(`load("scripts/drone/other.star", "function")

function()`)
		err := ioutil.WriteFile(filepath.Join(workspace, "has-lint.star"), invalidContent, os.ModePerm)
		if err != nil {
			t.Fatalf(err.Error())
		}

		errs := verifyStarlark(ctx, workspace)
		if len(errs) == 0 {
			t.Fatalf(`"has-lint.star" requires linting but the verifyStarlark function provided no linting error`)
		}
		if len(errs) > 1 {
			t.Fatalf(`verifyStarlark returned multiple errors for the "has-lint.star" file but only one was expected: %v`, errs)
		}
		if !strings.Contains(errs[0].Error(), "has-lint.star:1: module-docstring: The file has no module docstring.") {
			t.Fatalf(`"has-lint.star" is missing a module docstring but the verifyStarlark function linting error did not mention this`)
		}
	})

	t.Run("no files with lint", func(t *testing.T) {
		ctx := context.Background()
		workspace := t.TempDir()

		invalidContent := []byte(`"""
This module does nothing.
"""
load("scripts/drone/other.star", "function")

function()`)
		require.NoError(t, ioutil.WriteFile(filepath.Join(workspace, "no-lint.star"), invalidContent, os.ModePerm))

		errs := verifyStarlark(ctx, workspace)
		if len(errs) != 0 {
			t.Fatalf(`"no-lint.star" has no lint but the verifyStarlark function provided an error`)
		}
	})

	t.Run("multiple files with lint", func(t *testing.T) {
		ctx := context.Background()
		workspace := t.TempDir()

		invalidContent := []byte(`load("scripts/drone/other.star", "function")

function()`)
		require.NoError(t, ioutil.WriteFile(filepath.Join(workspace, "has-lint.star"), invalidContent, os.ModePerm))
		require.NoError(t, ioutil.WriteFile(filepath.Join(workspace, "has-lint2.star"), invalidContent, os.ModePerm))

		errs := verifyStarlark(ctx, workspace)
		if len(errs) == 0 {
			t.Fatalf(`Two files require linting but the verifyStarlark function provided no linting error`)
		}
		if len(errs) == 1 {
			t.Fatalf(`Two files require linting but the verifyStarlark function provided only one linting error: %v`, errs[0])
		}
		if len(errs) > 2 {
			t.Fatalf(`verifyStarlark returned more errors than expected: %v`, errs)
		}
		if !strings.Contains(errs[0].Error(), "has-lint.star:1: module-docstring: The file has no module docstring.") {
			t.Fatalf(`"has-lint.star" is missing a module docstring but the verifyStarlark function linting error did not mention this`)
		}
		if !strings.Contains(errs[1].Error(), "has-lint2.star:1: module-docstring: The file has no module docstring.") {
			t.Fatalf(`"has-lint.star" is missing a module docstring but the verifyStarlark function linting error did not mention this`)
		}
	})
}
