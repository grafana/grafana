package ngalert

import (
	"bytes"
	"context"
	"math/rand"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/folder"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func Test_subscribeToFolderChanges(t *testing.T) {
	orgID := rand.Int63()
	folder := &folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: "Folder" + util.GenerateShortUID(),
	}
	gen := models.RuleGen
	rules := gen.With(gen.WithOrgID(orgID), gen.WithNamespace(folder)).GenerateManyRef(5)

	bus := bus.ProvideBus(tracing.InitializeTracerForTest())
	db := fakes.NewRuleStore(t)
	db.Folders[orgID] = append(db.Folders[orgID], folder)
	db.PutRule(context.Background(), rules...)

	subscribeToFolderChanges(log.New("test"), bus, db)

	err := bus.Publish(context.Background(), &events.FolderTitleUpdated{
		Timestamp: time.Now(),
		Title:     "Folder" + util.GenerateShortUID(),
		UID:       folder.UID,
		OrgID:     orgID,
	})
	require.NoError(t, err)

	require.Eventuallyf(t, func() bool {
		return len(db.GetRecordedCommands(func(cmd any) (any, bool) {
			c, ok := cmd.(fakes.GenericRecordedQuery)
			if !ok || c.Name != "IncreaseVersionForAllRulesInNamespace" {
				return nil, false
			}
			return c, true
		})) > 0
	}, time.Second, 10*time.Millisecond, "expected to call db store method but nothing was called")
}

func TestConfigureHistorianBackend(t *testing.T) {
	t.Run("fail initialization if invalid backend", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "invalid-backend",
		}
		ac := &acfakes.FakeRuleService{}

		_, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.ErrorContains(t, err, "unrecognized")
	})

	t.Run("fail initialization if invalid multi-backend primary", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled:      true,
			Backend:      "multiple",
			MultiPrimary: "invalid-backend",
		}
		ac := &acfakes.FakeRuleService{}

		_, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.ErrorContains(t, err, "multi-backend target")
		require.ErrorContains(t, err, "unrecognized")
	})

	t.Run("fail initialization if invalid multi-backend secondary", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled:          true,
			Backend:          "multiple",
			MultiPrimary:     "annotations",
			MultiSecondaries: []string{"annotations", "invalid-backend"},
		}
		ac := &acfakes.FakeRuleService{}

		_, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.ErrorContains(t, err, "multi-backend target")
		require.ErrorContains(t, err, "unrecognized")
	})

	t.Run("do not fail initialization if pinging Loki fails", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "loki",
			// Should never resolve at the DNS level: https://www.rfc-editor.org/rfc/rfc6761#section-6.4
			LokiReadURL:  "http://gone.invalid",
			LokiWriteURL: "http://gone.invalid",
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.NotNil(t, h)
		require.NoError(t, err)
	})

	t.Run("emit metric describing chosen backend", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(reg, metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "annotations",
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.NotNil(t, h)
		require.NoError(t, err)
		exp := bytes.NewBufferString(`
# HELP grafana_alerting_state_history_info Information about the state history store.
# TYPE grafana_alerting_state_history_info gauge
grafana_alerting_state_history_info{backend="annotations"} 1
`)
		err = testutil.GatherAndCompare(reg, exp, "grafana_alerting_state_history_info")
		require.NoError(t, err)
	})

	t.Run("emit special zero metric if state history disabled", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(reg, metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: false,
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, nil, nil, nil, met, logger, tracer, ac)

		require.NotNil(t, h)
		require.NoError(t, err)
		exp := bytes.NewBufferString(`
# HELP grafana_alerting_state_history_info Information about the state history store.
# TYPE grafana_alerting_state_history_info gauge
grafana_alerting_state_history_info{backend="noop"} 0
`)
		err = testutil.GatherAndCompare(reg, exp, "grafana_alerting_state_history_info")
		require.NoError(t, err)
	})
}
