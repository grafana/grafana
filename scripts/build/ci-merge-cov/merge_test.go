package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAtomic(t *testing.T) {
	dir := t.TempDir()
	cov1Path := filepath.Join(dir, "one.cov")
	cov2Path := filepath.Join(dir, "two.cov")

	err := os.WriteFile(cov1Path, []byte(`mode: atomic
github.com/grafana/grafana/test/example.go:5.21,7.2 1 1
github.com/grafana/grafana/test/example.go:9.19,12.2 2 0
github.com/grafana/grafana/test/example.go:14.26,17.2 2 1`), 0644)
	require.NoError(t, err, "cov1Path setup")
	err = os.WriteFile(cov2Path, []byte(`mode: atomic
github.com/grafana/grafana/test/example.go:5.21,7.2 1 1
github.com/grafana/grafana/test/example.go:9.19,12.2 2 1
github.com/grafana/grafana/test/example.go:14.26,17.2 2 0`), 0644)
	require.NoError(t, err, "cov2Path setup")

	outPath := filepath.Join(dir, "out.cov")
	err = run([]string{"mergecov", outPath, cov1Path, cov2Path})
	require.NoError(t, err, "should not fail on running merge")

	out, err := os.ReadFile(outPath)
	require.NoError(t, err, "failed to read output")

	outStr := string(out)
	outStr = strings.TrimSpace(outStr)
	// We don't want the NumStmt to change. We're not adding anything.
	// We want the Count to change, though. This is because we're adding the amount of times we call the code.
	// As such, we want to just merge the code we know has been run.
	// The colours will get a bit funky in the HTML report from diluting the numbers a bit this way, but that's OK. The point is we want red lines to not be red if they're known to be covered.
	require.Equal(t, `mode: atomic
github.com/grafana/grafana/test/example.go:5.21,7.2 1 2
github.com/grafana/grafana/test/example.go:9.19,12.2 2 1
github.com/grafana/grafana/test/example.go:14.26,17.2 2 1`, outStr)
}
