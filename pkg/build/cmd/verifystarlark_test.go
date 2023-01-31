//go:build requires_buildifier

package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVerifyStarlark(t *testing.T) {
	t.Run("execution errors", func(t *testing.T) {
		t.Run("invalid usage", func(t *testing.T) {
			ctx := context.Background()
			workspace := t.TempDir()
			err := os.WriteFile(filepath.Join(workspace, "ignored.star"), []byte{}, os.ModePerm)
			if err != nil {
				t.Fatalf(err.Error())
			}

			_, executionErr := verifyStarlark(ctx, workspace, func(string) (string, []string) { return "buildifier", []string{"--invalid"} })
			if executionErr == nil {
				t.Fatalf("Expected execution error but got none")
			}
		})

		t.Run("context cancellation", func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			workspace := t.TempDir()
			err := os.WriteFile(filepath.Join(workspace, "ignored.star"), []byte{}, os.ModePerm)
			if err != nil {
				t.Fatalf(err.Error())
			}
			err = os.WriteFile(filepath.Join(workspace, "other-ignored.star"), []byte{}, os.ModePerm)
			if err != nil {
				t.Fatalf(err.Error())
			}
			cancel()

			_, executionErr := verifyStarlark(ctx, workspace, buildifierLintCommand)
			if executionErr == nil {
				t.Fatalf("Expected execution error but got none")
			}
		})
	})

	t.Run("verification errors", func(t *testing.T) {
		t.Run("a single file with lint", func(t *testing.T) {
			ctx := context.Background()
			workspace := t.TempDir()

			invalidContent := []byte(`load("scripts/drone/other.star", "function")

function()`)
			err := os.WriteFile(filepath.Join(workspace, "has-lint.star"), invalidContent, os.ModePerm)
			if err != nil {
				t.Fatalf(err.Error())
			}

			verificationErrs, executionErr := verifyStarlark(ctx, workspace, buildifierLintCommand)
			if executionErr != nil {
				t.Fatalf("Unexpected execution error: %v", executionErr)
			}
			if len(verificationErrs) == 0 {
				t.Fatalf(`"has-lint.star" requires linting but the verifyStarlark function provided no linting error`)
			}
			if len(verificationErrs) > 1 {
				t.Fatalf(`verifyStarlark returned multiple errors for the "has-lint.star" file but only one was expected: %v`, verificationErrs)
			}
			if !strings.Contains(verificationErrs[0].Error(), "has-lint.star:1: module-docstring: The file has no module docstring.") {
				t.Fatalf(`"has-lint.star" is missing a module docstring but the verifyStarlark function linting error did not mention this, instead we got: %v`, verificationErrs[0])
			}
		})

		t.Run("no files with lint", func(t *testing.T) {
			ctx := context.Background()
			workspace := t.TempDir()

			content := []byte(`"""
This module does nothing.
"""

load("scripts/drone/other.star", "function")

function()
`)
			require.NoError(t, os.WriteFile(filepath.Join(workspace, "no-lint.star"), content, os.ModePerm))

			verificationErrs, executionErr := verifyStarlark(ctx, workspace, buildifierLintCommand)
			if executionErr != nil {
				t.Fatalf("Unexpected execution error: %v", executionErr)
			}
			if len(verificationErrs) != 0 {
				t.Log(`"no-lint.star" has no lint but the verifyStarlark function provided at least one error`)
				for _, err := range verificationErrs {
					t.Log(err)
				}
				t.FailNow()
			}
		})

		t.Run("multiple files with lint", func(t *testing.T) {
			ctx := context.Background()
			workspace := t.TempDir()

			invalidContent := []byte(`load("scripts/drone/other.star", "function")

function()`)
			require.NoError(t, os.WriteFile(filepath.Join(workspace, "has-lint.star"), invalidContent, os.ModePerm))
			require.NoError(t, os.WriteFile(filepath.Join(workspace, "has-lint2.star"), invalidContent, os.ModePerm))

			verificationErrs, executionErr := verifyStarlark(ctx, workspace, buildifierLintCommand)
			if executionErr != nil {
				t.Fatalf("Unexpected execution error: %v", executionErr)
			}
			if len(verificationErrs) == 0 {
				t.Fatalf(`Two files require linting but the verifyStarlark function provided no linting error`)
			}
			if len(verificationErrs) == 1 {
				t.Fatalf(`Two files require linting but the verifyStarlark function provided only one linting error: %v`, verificationErrs[0])
			}
			if len(verificationErrs) > 2 {
				t.Fatalf(`verifyStarlark returned more errors than expected: %v`, verificationErrs)
			}
			if !strings.Contains(verificationErrs[0].Error(), "has-lint.star:1: module-docstring: The file has no module docstring.") {
				t.Errorf(`"has-lint.star" is missing a module docstring but the verifyStarlark function linting error did not mention this, instead we got: %v`, verificationErrs[0])
			}
			if !strings.Contains(verificationErrs[1].Error(), "has-lint2.star:1: module-docstring: The file has no module docstring.") {
				t.Fatalf(`"has-lint2.star" is missing a module docstring but the verifyStarlark function linting error did not mention this, instead we got: %v`, verificationErrs[0])
			}
		})
	})
}
