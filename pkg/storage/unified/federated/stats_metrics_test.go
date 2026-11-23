package federated

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// observations returns how many durations were recorded for the labels.
func observations(t *testing.T, reg *prometheus.Registry, resourceName, outcome string) uint64 {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() != "grafana_folder_counts_legacy_query_duration_seconds" {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["resource"] == resourceName && labels["outcome"] == outcome {
				return m.GetHistogram().GetSampleCount()
			}
		}
	}
	t.Fatalf("no series for %s/%s", resourceName, outcome)
	return 0
}

func TestLegacyStatsMetricsObserveOutcome(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{name: "success", want: legacyOutcomeOK},
		{name: "failure", err: errors.New("boom"), want: legacyOutcomeError},
		{name: "timeout is a failure", err: context.DeadlineExceeded, want: legacyOutcomeError},
		{name: "wrapped cancellation", err: fmt.Errorf("query: %w", context.Canceled), want: legacyOutcomeCanceled},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			m := newLegacyStatsMetrics(reg)

			m.observe(legacyAlertRules, time.Now(), tt.err)

			for _, outcome := range legacyOutcomes {
				want := uint64(0)
				if outcome == tt.want {
					want = 1
				}
				require.Equal(t, want, observations(t, reg, legacyAlertRules, outcome), outcome)
			}
			require.Equal(t, uint64(0), observations(t, reg, legacyRecordingRules, tt.want), "other resources are untouched")
		})
	}
}

// seriesOf lists the label values of every series of a metric, joined as "resource/other".
func seriesOf(t *testing.T, reg *prometheus.Registry, metric, otherLabel string) []string {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)
	var out []string
	for _, f := range families {
		if f.GetName() != metric {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			out = append(out, labels["resource"]+"/"+labels[otherLabel])
		}
	}
	return out
}

func TestLegacyStatsMetricsExistBeforeAnyObservation(t *testing.T) {
	reg := prometheus.NewRegistry()
	newLegacyStatsMetrics(reg)

	require.ElementsMatch(t, []string{
		"alertrules/ok", "alertrules/error", "alertrules/canceled",
		"recordingrules/ok", "recordingrules/error", "recordingrules/canceled",
		"library_elements/ok", "library_elements/error", "library_elements/canceled",
	}, seriesOf(t, reg, "grafana_folder_counts_legacy_query_duration_seconds", "outcome"))
	require.ElementsMatch(t, []string{
		"alertrules/migrated", "alertrules/namespace_deleted",
		"recordingrules/migrated", "recordingrules/namespace_deleted",
		"library_elements/migrated", "library_elements/namespace_deleted",
	}, seriesOf(t, reg, "grafana_folder_counts_legacy_skipped_total", "reason"))
}

func TestLegacyStatsMetricsNilRecordsNothing(t *testing.T) {
	var m *legacyStatsMetrics
	require.NotPanics(t, func() {
		m.observe(legacyAlertRules, time.Now(), nil)
		m.skip(legacyAlertRules, legacySkipMigrated)
	})
	require.NotNil(t, newLegacyStatsMetrics(nil), "a nil registerer still records, unregistered")
}

func TestFederatedGetStatsCountsSkippedForDeletedNamespace(t *testing.T) {
	reg := prometheus.NewRegistry()
	base := resource.NewMockResourceClient(t)
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
	client := NewFederatedClient(base, func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, fmt.Errorf("lookup stack: %w", legacysql.ErrNamespaceDeleted)
	}, nil, WithMetrics(reg))

	_, err := client.GetStats(t.Context(), in)
	require.NoError(t, err)

	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_folder_counts_legacy_skipped_total Legacy database counts that were not run, by resource and reason
# TYPE grafana_folder_counts_legacy_skipped_total counter
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="alertrules"} 0
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="library_elements"} 0
grafana_folder_counts_legacy_skipped_total{reason="migrated",resource="recordingrules"} 0
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="alertrules"} 1
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="library_elements"} 1
grafana_folder_counts_legacy_skipped_total{reason="namespace_deleted",resource="recordingrules"} 1
`), "grafana_folder_counts_legacy_skipped_total"))
}

func TestFederatedGetStatsRecordsLegacyAccessFailures(t *testing.T) {
	tests := []struct {
		name     string
		provider legacysql.LegacyDatabaseProvider
		want     string
	}{
		{name: "no legacy source", provider: nil, want: legacyOutcomeError},
		{name: "provider failure", provider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, errors.New("connect: refused")
		}, want: legacyOutcomeError},
		{name: "caller went away during the lookup", provider: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, fmt.Errorf("lookup stack: %w", context.Canceled)
		}, want: legacyOutcomeCanceled},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			base := resource.NewMockResourceClient(t)
			in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
			base.On("GetStats", mock.Anything, in).Return(&resourcepb.ResourceStatsResponse{}, nil).Once()
			client := NewFederatedClient(base, tt.provider, nil, WithMetrics(reg))

			_, err := client.GetStats(t.Context(), in)
			require.Error(t, err)

			for _, name := range legacyResources {
				require.Equal(t, uint64(1), observations(t, reg, name, tt.want), name)
				require.Equal(t, uint64(0), observations(t, reg, name, legacyOutcomeOK), name)
			}
		})
	}
}

// recordedLog is one log line captured by recordingLogger.
type recordedLog struct {
	level  string
	msg    string
	fields map[string]any
}

// recordingLogger captures log lines; logtest.Fake can't, because its FromContext returns a no-op logger.
type recordingLogger struct{ lines *[]recordedLog }

func newRecordingLogger() recordingLogger { return recordingLogger{lines: &[]recordedLog{}} }

func (r recordingLogger) record(level, msg string, kv []any) {
	fields := map[string]any{}
	for i := 0; i+1 < len(kv); i += 2 {
		fields[fmt.Sprint(kv[i])] = kv[i+1]
	}
	*r.lines = append(*r.lines, recordedLog{level: level, msg: msg, fields: fields})
}

func (r recordingLogger) New(...any) *log.ConcreteLogger         { return log.NewNopLogger() }
func (r recordingLogger) Log(...any) error                       { return nil }
func (r recordingLogger) Debug(msg string, kv ...any)            { r.record("debug", msg, kv) }
func (r recordingLogger) Info(msg string, kv ...any)             { r.record("info", msg, kv) }
func (r recordingLogger) Warn(msg string, kv ...any)             { r.record("warn", msg, kv) }
func (r recordingLogger) Error(msg string, kv ...any)            { r.record("error", msg, kv) }
func (r recordingLogger) FromContext(context.Context) log.Logger { return r }

// withMsg returns the captured lines with the message.
func (r recordingLogger) withMsg(msg string) []recordedLog {
	var out []recordedLog
	for _, l := range *r.lines {
		if l.msg == msg {
			out = append(out, l)
		}
	}
	return out
}

func TestLegacyStatsLogsLookupFailures(t *testing.T) {
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1", "f2"}}
	tests := []struct {
		name      string
		err       error
		wantLevel string
		wantMsg   string
	}{
		{name: "failure", err: errors.New("connect: refused"), wantLevel: "error", wantMsg: "Legacy database lookup failed"},
		{name: "caller went away", err: fmt.Errorf("lookup: %w", context.Canceled), wantLevel: "debug", wantMsg: "Legacy database lookup canceled"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := newRecordingLogger()
			s := &LegacyStatsGetter{
				SQL:    func(context.Context) (*legacysql.LegacyDatabaseHelper, error) { return nil, tt.err },
				logger: logger,
			}

			_, err := s.GetStats(t.Context(), in)
			require.Error(t, err)

			require.Len(t, *logger.lines, 1)
			line := (*logger.lines)[0]
			require.Equal(t, tt.wantLevel, line.level)
			require.Equal(t, tt.wantMsg, line.msg)
			require.Equal(t, "stacks-123", line.fields["namespace"])
			require.Equal(t, "f1", line.fields["folder"], "the first folder is named")
			require.Equal(t, 2, line.fields["folderCount"])
			require.Equal(t, tt.err, line.fields["error"])
			require.NotContains(t, line.fields, "dbServer", "the server isn't known before the lookup succeeds")
		})
	}
}

func TestLegacyStatsLogsSkippedCountsAtDebug(t *testing.T) {
	logger := newRecordingLogger()
	s := &LegacyStatsGetter{
		SQL: func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, fmt.Errorf("lookup stack: %w", legacysql.ErrNamespaceDeleted)
		},
		logger: logger,
	}

	_, err := s.GetStats(t.Context(), &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}})
	require.NoError(t, err)

	lines := logger.withMsg("Skipped legacy count")
	require.Len(t, lines, 3, "one per resource")
	for _, l := range lines {
		require.Equal(t, "debug", l.level)
		require.Equal(t, legacySkipNamespaceDeleted, l.fields["reason"])
		require.Equal(t, "stacks-123", l.fields["namespace"])
	}
	require.Len(t, *logger.lines, 3, "a deleted namespace is not an error")
}

func TestLegacyStatsLogsTheCaller(t *testing.T) {
	run := func(ctx context.Context) recordedLog {
		logger := newRecordingLogger()
		s := &LegacyStatsGetter{
			SQL:    func(context.Context) (*legacysql.LegacyDatabaseHelper, error) { return nil, errors.New("boom") },
			logger: logger,
		}
		_, err := s.GetStats(ctx, &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}})
		require.Error(t, err)
		require.Len(t, *logger.lines, 1)
		return (*logger.lines)[0]
	}

	require.Equal(t, "delete_check", run(WithCaller(t.Context(), "delete_check")).fields["caller"])
	require.NotContains(t, run(t.Context()).fields, "caller", "an unnamed caller adds no field")
}

func TestLegacyStatsLogsAMissingSourceOnlyOnceAsAnError(t *testing.T) {
	logger := newRecordingLogger()
	s := &LegacyStatsGetter{logger: logger}
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}

	for range 3 {
		_, err := s.GetStats(t.Context(), in)
		require.ErrorIs(t, err, ErrLegacyStatsUnavailable)
	}

	require.Len(t, *logger.lines, 3)
	require.Equal(t, "error", (*logger.lines)[0].level)
	require.Equal(t, "Legacy database lookup failed", (*logger.lines)[0].msg)
	for _, l := range (*logger.lines)[1:] {
		require.Equal(t, "debug", l.level)
		require.Equal(t, "Legacy count source still unavailable", l.msg)
	}
}

func TestLegacyStatsAccessedLogsEachOutcomeAtItsLevel(t *testing.T) {
	in := &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}
	tests := []struct {
		name       string
		err        error
		server     string
		wantLevel  string
		wantMsg    string
		wantOutput string
	}{
		{name: "success", wantLevel: "debug", wantMsg: "Counted legacy resources", wantOutput: legacyOutcomeOK, server: "db-1"},
		{name: "caller went away", err: fmt.Errorf("query: %w", context.Canceled), wantLevel: "debug", wantMsg: "Legacy count canceled", wantOutput: legacyOutcomeCanceled, server: "db-1"},
		{name: "failure", err: errors.New("boom"), wantLevel: "error", wantMsg: "Legacy count failed", wantOutput: legacyOutcomeError, server: "db-1"},
		{name: "failure on a server that isn't named", err: errors.New("boom"), wantLevel: "error", wantMsg: "Legacy count failed", wantOutput: legacyOutcomeError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := newRecordingLogger()
			s := &LegacyStatsGetter{logger: logger}

			s.accessed(t.Context(), in, tt.server, legacyAlertRules, time.Now(), tt.err)

			require.Len(t, *logger.lines, 1)
			line := (*logger.lines)[0]
			require.Equal(t, tt.wantLevel, line.level)
			require.Equal(t, tt.wantMsg, line.msg)
			require.Equal(t, tt.wantOutput, line.fields["outcome"])
			require.Equal(t, legacyAlertRules, line.fields["resource"])
			if tt.server == "" {
				require.NotContains(t, line.fields, "dbServer")
			} else {
				require.Equal(t, tt.server, line.fields["dbServer"])
			}
			if tt.err != nil {
				require.Equal(t, tt.err, line.fields["error"])
			} else {
				require.NotContains(t, line.fields, "error")
			}
		})
	}
}

func TestLegacyStatsSkippedLogsTheReasonAtDebug(t *testing.T) {
	logger := newRecordingLogger()
	s := &LegacyStatsGetter{logger: logger}

	s.skipped(t.Context(), &resourcepb.ResourceStatsRequest{Namespace: "stacks-123", Folder: []string{"f1"}}, "db-1", legacyLibraryElements, legacySkipMigrated)

	require.Len(t, *logger.lines, 1)
	line := (*logger.lines)[0]
	require.Equal(t, "debug", line.level)
	require.Equal(t, "Skipped legacy count", line.msg)
	require.Equal(t, legacyLibraryElements, line.fields["resource"])
	require.Equal(t, legacySkipMigrated, line.fields["reason"])
	require.Equal(t, "db-1", line.fields["dbServer"])
}
