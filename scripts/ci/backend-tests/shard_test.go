package backendtests

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestShardPartitions(t *testing.T) {
	root, packages := shardFixture(t)
	inputs := []struct {
		name  string
		args  []string
		stdin string
	}{
		{name: "module discovery"},
		{
			name: "reversed directories",
			args: []string{"-d", "./no_tests", "-d", "./e", "-d", "./d", "-d", "./c", "-d", "./b", "-d", "./a"},
		},
		{
			name:  "stdin with duplicates",
			args:  []string{"-d", "-"},
			stdin: "./e\n./a\n./c\n./b\n./a\n./d\n./e\n./no_tests\n",
		},
		{
			name: "overlapping patterns",
			args: []string{"-d", "./e", "-d", "./...", "-d", "./a"},
		},
	}

	for _, count := range []int{2, 3, 8} {
		t.Run(fmt.Sprintf("%d shards", count), func(t *testing.T) {
			var expected [][]string
			for _, input := range inputs {
				t.Run(input.name, func(t *testing.T) {
					partitions := make([][]string, count)
					var all []string
					for i := range count {
						args := append([]string{"-N", fmt.Sprintf("%d/%d", i+1, count)}, input.args...)
						partitions[i] = strings.Fields(runShard(t, root, input.stdin, args...))
						all = append(all, partitions[i]...)
					}
					// ElementsMatch also rejects duplicates across or within shards.
					require.ElementsMatch(t, packages, all)
					if expected == nil {
						expected = partitions
					} else {
						require.Equal(t, expected, partitions)
					}
				})
			}
		})
	}
}

func TestShardSpaceSeparatedOutput(t *testing.T) {
	root, _ := shardFixture(t)
	lines := runShard(t, root, "", "-n", "1", "-m", "3", "-d", "./...")
	spaces := runShard(t, root, "", "-n", "1", "-m", "3", "-d", "./...", "-s")
	require.NotEmpty(t, lines)
	require.Equal(t, strings.ReplaceAll(lines, "\n", " "), spaces)
}

func TestShardSingleShardPassThrough(t *testing.T) {
	root, _ := shardFixture(t)
	input := "./e\n./a\n./...\n./a\n"
	output := runShard(t, root, input, "-N", "1/1", "-d", "-")
	require.Equal(t, input, output)
}

func TestShardBalancesPackageWeights(t *testing.T) {
	root := t.TempDir()
	weights := filepath.Join(root, "weights.txt")
	require.NoError(t, os.WriteFile(weights, []byte(`# Estimated seconds
example.com/grafana/api 40
example.com/grafana/db 35
example.com/enterprise/api 32
example.com/enterprise/db 20
example.com/grafana/removed 200
`), 0o600))

	packages := []string{
		"example.com/grafana/api",
		"example.com/grafana/db",
		"example.com/grafana/new",
		"example.com/enterprise/api",
		"example.com/enterprise/db",
		"example.com/enterprise/new",
		"example.com/grafana/api",
	}
	want := [][]string{
		{"example.com/grafana/api", "example.com/enterprise/db", "example.com/enterprise/new"},
		{"example.com/grafana/db", "example.com/enterprise/api", "example.com/grafana/new"},
	}

	for range 2 {
		for i, expected := range want {
			got := runShard(t, root, strings.Join(packages, "\n")+"\n",
				"-N", fmt.Sprintf("%d/2", i+1), "-d", "-", "-w", weights)
			require.ElementsMatch(t, expected, strings.Fields(got), "shard %d", i+1)
		}
		slices.Reverse(packages)
	}
}

func TestSQLIntegrationRunnerRunsEachBinaryOnce(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/integration\n"), 0o600))
	for _, pkg := range []string{"first/api", "second/api"} {
		dir := filepath.Join(root, pkg)
		require.NoError(t, os.MkdirAll(dir, 0o700))
		require.NoError(t, os.WriteFile(filepath.Join(dir, "marker"), []byte(pkg+"\n"), 0o600))
		require.NoError(t, os.WriteFile(filepath.Join(dir, "api_test.go"), []byte(`package api

import (
	"flag"
	"os"
	"strings"
	"testing"
)

func TestMain(m *testing.M) {
	marker, err := os.ReadFile("marker")
	if err != nil {
		panic(err)
	}
	file, err := os.OpenFile(os.Getenv("TEST_INVOCATIONS"), os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0600)
	if err != nil {
		panic(err)
	}
	if _, err := file.Write(marker); err != nil {
		panic(err)
	}
	if err := file.Close(); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func TestIntegrationFixture(t *testing.T) {
	if timeout := flag.Lookup("test.timeout").Value.String(); timeout != "12m0s" {
		t.Fatalf("unexpected timeout %s", timeout)
	}
	marker, err := os.ReadFile("marker")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(marker)) == os.Getenv("FAIL_PACKAGE") {
		t.Fatal("intentional test failure")
	}
}

func TestUnitFixture(t *testing.T) {
	t.Fatal("unit tests must be excluded")
}
`), 0o600))
	}

	inactive := filepath.Join(root, "inactive")
	require.NoError(t, os.MkdirAll(inactive, 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(inactive, "package.go"), []byte("package inactive\n"), 0o600))
	require.NoError(t, os.WriteFile(filepath.Join(inactive, "inactive_test.go"), []byte(`//go:build ignore

package inactive

func TestIntegrationIgnored() {}
`), 0o600))

	script, err := filepath.Abs("run-sql-integration-shard.sh")
	require.NoError(t, err)
	for _, tc := range []struct{ name, fail string }{
		{name: "all packages pass"},
		{name: "continues after a failure", fail: "first/api"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			invocations := filepath.Join(t.TempDir(), "invocations")
			cmd := exec.CommandContext(t.Context(), "bash", script, "1/1")
			cmd.Dir = root
			cmd.Env = append(cmd.Environ(), "GOWORK=off", "GOPROXY=off", "RUNNER_TEMP="+t.TempDir(),
				"TEST_INVOCATIONS="+invocations, "FAIL_PACKAGE="+tc.fail)
			output, err := cmd.CombinedOutput()
			if tc.fail == "" {
				require.NoError(t, err, "%s", output)
			} else {
				require.Error(t, err)
				require.Contains(t, string(output), "intentional test failure")
			}
			calls, err := os.ReadFile(invocations)
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"first/api", "second/api"}, strings.Fields(string(calls)))
			require.Regexp(t, `(?m)^ok\s+example\.com/integration/second/api\s+`, string(output))
			require.Regexp(t, `(?m)^\?\s+example\.com/integration/inactive\s+\[no test files\]`, string(output))
		})
	}
}

func shardFixture(t *testing.T) (string, []string) {
	t.Helper()
	root, err := filepath.EvalSymlinks(t.TempDir())
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/shards\n"), 0o600))

	var packages []string
	for _, name := range []string{"a", "b", "c", "d", "e", "no_tests"} {
		dir := filepath.Join(root, name)
		require.NoError(t, os.MkdirAll(dir, 0o700))
		file := "fixture_test.go"
		if name == "no_tests" {
			file = "fixture.go"
		} else {
			packages = append(packages, dir)
		}
		require.NoError(t, os.WriteFile(filepath.Join(dir, file), []byte("package fixture\n"), 0o600))
	}
	return root, packages
}

func runShard(t *testing.T, root, stdin string, args ...string) string {
	t.Helper()
	script, err := filepath.Abs("shard.sh")
	require.NoError(t, err)
	cmd := exec.CommandContext(t.Context(), "bash", append([]string{script}, args...)...)
	cmd.Dir = root
	cmd.Stdin = strings.NewReader(stdin)
	cmd.Env = append(cmd.Environ(), "GOWORK=off", "GOPROXY=off")
	var stderr strings.Builder
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	require.NoError(t, err, "shard.sh %v: %s", args, stderr.String())
	return string(output)
}
