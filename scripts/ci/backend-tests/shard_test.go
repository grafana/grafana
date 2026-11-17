package backendtests

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
