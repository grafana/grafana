package api

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func ctxValue(t *testing.T, ctx []any, key string) any {
	t.Helper()
	for i := 0; i+1 < len(ctx); i += 2 {
		if ctx[i] == key {
			return ctx[i+1]
		}
	}
	t.Fatalf("log line has no %q field: %v", key, ctx)
	return nil
}

func TestLogPanelDiagnosticsBundle(t *testing.T) {
	t.Run("a complete bundle is logged at info", func(t *testing.T) {
		fake := &logtest.Fake{}
		logPanelDiagnosticsBundle(fake, panelDiagnosticsOutcome{
			durationMs: 12, queries: 2, bundleBytes: 4096, harEntries: 3, capturedHAR: true,
		})

		require.Equal(t, 1, fake.InfoLogs.Calls)
		require.Zero(t, fake.WarnLogs.Calls)
		require.Equal(t, 3, ctxValue(t, fake.InfoLogs.Ctx, "harEntries"))
		require.Equal(t, 4096, ctxValue(t, fake.InfoLogs.Ctx, "bundleBytes"))
	})

	t.Run("a captured query failure is still a successful run", func(t *testing.T) {
		fake := &logtest.Fake{}
		logPanelDiagnosticsBundle(fake, panelDiagnosticsOutcome{capturedHAR: true, harEntries: 1, queryFailed: true})

		require.Equal(t, 1, fake.InfoLogs.Calls)
		require.Zero(t, fake.WarnLogs.Calls)
		require.Equal(t, true, ctxValue(t, fake.InfoLogs.Ctx, "queryFailed"))
	})

	t.Run("a bundle with no captured traffic warns", func(t *testing.T) {
		fake := &logtest.Fake{}
		logPanelDiagnosticsBundle(fake, panelDiagnosticsOutcome{queries: 1, bundleBytes: 512})

		require.Equal(t, 1, fake.WarnLogs.Calls)
		require.Zero(t, fake.InfoLogs.Calls)
		require.Equal(t, false, ctxValue(t, fake.WarnLogs.Ctx, "capturedHar"))
	})

	t.Run("an unserializable request warns even with captured traffic", func(t *testing.T) {
		fake := &logtest.Fake{}
		logPanelDiagnosticsBundle(fake, panelDiagnosticsOutcome{capturedHAR: true, harEntries: 2, requestError: true})

		require.Equal(t, 1, fake.WarnLogs.Calls)
		require.Zero(t, fake.InfoLogs.Calls)
		require.Equal(t, true, ctxValue(t, fake.WarnLogs.Ctx, "requestSerializeFailed"))
	})
}

func TestLogDashboardDiagnosticsBundle(t *testing.T) {
	t.Run("panelsRun is reported net of skipped panels", func(t *testing.T) {
		fake := &logtest.Fake{}
		logDashboardDiagnosticsBundle(fake, dashboardDiagnosticsOutcome{
			jobUID: "job-1", panelsTotal: 5, panelsSkipped: 2, panelsFailed: 1, panelsCaptured: 3,
		})

		require.Equal(t, 1, fake.InfoLogs.Calls)
		require.Zero(t, fake.WarnLogs.Calls)
		require.Equal(t, 3, ctxValue(t, fake.InfoLogs.Ctx, "panelsRun"))
		require.Equal(t, "job-1", ctxValue(t, fake.InfoLogs.Ctx, "jobUid"))
	})

	t.Run("run panels that captured nothing warn", func(t *testing.T) {
		fake := &logtest.Fake{}
		logDashboardDiagnosticsBundle(fake, dashboardDiagnosticsOutcome{jobUID: "job-2", panelsTotal: 3})

		require.Equal(t, 1, fake.WarnLogs.Calls)
		require.Zero(t, fake.InfoLogs.Calls)
		require.Equal(t, 0, ctxValue(t, fake.WarnLogs.Ctx, "panelsCaptured"))
	})

	t.Run("a dashboard of only skipped panels does not warn", func(t *testing.T) {
		fake := &logtest.Fake{}
		logDashboardDiagnosticsBundle(fake, dashboardDiagnosticsOutcome{jobUID: "job-3", panelsTotal: 2, panelsSkipped: 2})

		require.Equal(t, 1, fake.InfoLogs.Calls)
		require.Zero(t, fake.WarnLogs.Calls)
		require.Equal(t, 0, ctxValue(t, fake.InfoLogs.Ctx, "panelsRun"))
	})
}
