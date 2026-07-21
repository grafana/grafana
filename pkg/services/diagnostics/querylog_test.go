package diagnostics

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestScopedQueryLogMatchesTraceAndAnchoredDatasourceUIDs(t *testing.T) {
	lines := []string{
		"logger=request traceID=abc123 msg=trace",
		"logger=plugin dsUID=prom msg=plugin",
		"logger=datasources msg=cache uid=loki",
		"logger=other dsUid=tempo",
		"logger=other datasourceUID=pyroscope",
		"logger=tsdb.prometheus msg=bare-substring",
		"logger=plugin uid=prometheus msg=uid-prefix",
		"logger=other uid=unrelated",
		"logger=other msg=contains-abc123-in-message",
		`logger=other msg="contains uid=prom in a quoted value"`,
		`logger=other msg="contains traceID=abc123 in a quoted value"`,
	}

	got := ScopedQueryLog(lines, "abc123", []string{"prom", "loki", "tempo", "pyroscope"})
	require.Equal(t, strings.Join(lines[:5], "\n")+"\n", string(got))
}

func TestScopedQueryLogSkipsEmptyTraceAndDatasourceUIDs(t *testing.T) {
	lines := []string{"logger=x traceID=whatever uid=__expr__", "logger=x uid=prom"}
	require.Nil(t, ScopedQueryLog(lines, "", nil))
	require.Nil(t, ScopedQueryLog(lines, "", []string{"", "__expr__"}))
	require.Equal(t, lines[1]+"\n", string(ScopedQueryLog(lines, "", []string{"prom", "prom"})))
}

func TestScopedQueryLogKeepsTailWithinLineCap(t *testing.T) {
	lines := make([]string, queryLogMaxLines+2)
	for i := range lines {
		lines[i] = fmt.Sprintf("logger=x uid=prom line=%d", i)
	}

	got := strings.Split(strings.TrimSuffix(string(ScopedQueryLog(lines, "", []string{"prom"})), "\n"), "\n")
	require.Len(t, got, queryLogMaxLines+1)
	require.Equal(t, "[diagnostics: query.log truncated; retained last 1000 of 1002 matching lines]", got[0])
	require.Contains(t, got[1], "line=2")
}

func TestScopedQueryLogKeepsTailWithinByteCap(t *testing.T) {
	first := "logger=x uid=prom line=first " + strings.Repeat("a", 700_000)
	second := "logger=x uid=prom line=second " + strings.Repeat("b", 700_000)

	got := ScopedQueryLog([]string{first, second}, "", []string{"prom"})
	require.Contains(t, string(got), "[diagnostics: query.log truncated;")
	require.NotContains(t, string(got), "line=first")
	require.Contains(t, string(got), "line=second")
	require.LessOrEqual(t, len(got), queryLogMaxBytes)
}

func TestScopedQueryLogReturnsNilWithoutMatches(t *testing.T) {
	require.Nil(t, ScopedQueryLog([]string{"logger=x uid=other"}, "missing", []string{"prom"}))
}

func TestServerWindowLogIncludesAllCapturedLines(t *testing.T) {
	lines := []string{
		"logger=plugin dsUID=prom msg=matching",
		"logger=background msg=unrelated",
	}

	require.Equal(t, strings.Join(lines, "\n")+"\n", string(ServerWindowLog(lines)))
}

func TestServerWindowLogKeepsNewestLinesAndMarksTruncation(t *testing.T) {
	lines := make([]string, 2002)
	for i := range lines {
		lines[i] = fmt.Sprintf("line=%d", i)
	}

	got := strings.Split(strings.TrimSuffix(string(ServerWindowLog(lines)), "\n"), "\n")
	require.Len(t, got, 2001)
	require.Equal(t, "[diagnostics: server-window.log truncated; retained last 2000 of 2002 lines]", got[0])
	require.Equal(t, "line=2", got[1])
	require.Equal(t, "line=2001", got[len(got)-1])
}

func TestServerWindowLogStaysWithinByteCap(t *testing.T) {
	lines := make([]string, 300)
	for i := range lines {
		prefix := fmt.Sprintf("line=%03d ", i)
		lines[i] = prefix + strings.Repeat("x", 8*1024-len(prefix))
	}

	got := ServerWindowLog(lines)
	require.LessOrEqual(t, len(got), 2*1024*1024)
	require.Contains(t, string(got), "server-window.log truncated")
	require.NotContains(t, string(got), "line=000 ")
	require.Contains(t, string(got), "line=299 ")
}
