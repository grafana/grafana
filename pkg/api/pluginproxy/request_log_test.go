package pluginproxy

import (
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func TestProxyRequestLog(t *testing.T) {
	logger := &logtest.Fake{}
	var count atomic.Uint64
	entry := RequestLog{PluginID: "prometheus", DatasourceUID: "ds-1", Method: "GET",
		Path: "/query?token=secret", Status: 503, Source: "downstream"}
	entry.write(logger, &count)
	require.Equal(t, 1, logger.WarnLogs.Calls)
	require.Contains(t, logger.WarnLogs.Ctx, "ds-1")
	require.Contains(t, logger.WarnLogs.Ctx, "/query")
	require.NotContains(t, logger.WarnLogs.Ctx, entry.Path)

	entry.Status, entry.Source = 499, "client"
	entry.write(logger, &count)
	entry.Status, entry.Source = 500, "server"
	entry.write(logger, &count)
	require.Equal(t, 3, logger.WarnLogs.Calls)

	entry.Status, entry.Source = 200, "server"
	entry.Path = strings.Repeat("a", 250)
	for range 999 {
		entry.write(logger, &count)
	}
	require.Zero(t, logger.InfoLogs.Calls)
	entry.write(logger, &count)
	require.Equal(t, 1, logger.InfoLogs.Calls)
	require.Contains(t, logger.InfoLogs.Ctx, entry.Path[:200])
}
