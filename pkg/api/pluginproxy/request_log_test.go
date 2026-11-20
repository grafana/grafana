package pluginproxy

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func TestProxyRequestLogLifecycle(t *testing.T) {
	previous := requestLogger
	t.Cleanup(func() { requestLogger = previous })
	for _, tc := range []struct {
		status int
		source string
	}{
		{http.StatusOK, "server"},
		{499, "client"},
		{http.StatusServiceUnavailable, "downstream"},
	} {
		logger := &logtest.Fake{}
		requestLogger = logger
		entry := RequestLog{PluginID: "prometheus", Path: "api/v1/query?query=up"}
		entry.Start()
		require.Equal(t, "Plugin Request Started", logger.InfoLogs.Message)
		startFields := logger.InfoLogs.Ctx
		require.Equal(t, []any{"eventName", "grafana-data-egress", "pluginId", "prometheus", "datasourceUid", "",
			"namespace", "", "method", "", "path", "api/v1/query"}, startFields)

		entry.Complete(tc.status, tc.source)
		completion := logger.InfoLogs
		if tc.status >= http.StatusBadRequest {
			completion = logger.ErrorLogs
		}
		require.Equal(t, "Plugin Request Completed", completion.Message)
		require.Equal(t, append(startFields, "status", tc.status, "statusSource", tc.source, "duration"), completion.Ctx[:len(completion.Ctx)-1])
		require.IsType(t, time.Duration(0), completion.Ctx[len(completion.Ctx)-1])
	}
}
