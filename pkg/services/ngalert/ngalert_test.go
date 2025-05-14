package ngalert

import (
	"bytes"
	"context"
	"math/rand"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func Test_subscribeToFolderChanges(t *testing.T) {
	getRecordedCommand := func(ruleStore *fakes.RuleStore) []fakes.GenericRecordedQuery {
		results := ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
			c, ok := cmd.(fakes.GenericRecordedQuery)
			if !ok || c.Name != "IncreaseVersionForAllRulesInNamespaces" {
				return nil, false
			}
			return c, ok
		})
		var result []fakes.GenericRecordedQuery
		for _, cmd := range results {
			result = append(result, cmd.(fakes.GenericRecordedQuery))
		}
		return result
	}

	orgID := rand.Int63()
	folder1 := &folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: "Folder" + util.GenerateShortUID(),
	}
	folder2 := &folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: "Folder" + util.GenerateShortUID(),
	}
	gen := models.RuleGen
	rules := gen.With(gen.WithOrgID(orgID), gen.WithNamespace(folder1)).GenerateManyRef(5)

	bus := bus.ProvideBus(tracing.InitializeTracerForTest())
	db := fakes.NewRuleStore(t)
	db.Folders[orgID] = append(db.Folders[orgID], folder1)
	db.PutRule(context.Background(), rules...)

	subscribeToFolderChanges(log.New("test"), bus, db)

	err := bus.Publish(context.Background(), &events.FolderFullPathUpdated{
		Timestamp: time.Now(),
		UIDs:      []string{folder1.UID, folder2.UID},
		OrgID:     orgID,
	})
	require.NoError(t, err)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		recordedCommands := getRecordedCommand(db)
		require.Len(c, recordedCommands, 1)
		require.Equal(c, recordedCommands[0].Params[0].(int64), orgID)
		require.ElementsMatch(c, recordedCommands[0].Params[1].([]string), []string{folder1.UID, folder2.UID})
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

type mockDB struct {
	db.DB
}

func TestInitInstanceStore(t *testing.T) {
	sqlStore := &mockDB{}
	logger := log.New()

	tests := []struct {
		name                      string
		ft                        featuremgmt.FeatureToggles
		expectedInstanceStoreType interface{}
	}{
		{
			name: "Compressed flag enabled, no periodic flag",
			ft: featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStateCompressed,
			),
			expectedInstanceStoreType: store.ProtoInstanceDBStore{},
		},
		{
			name: "Compressed flag enabled with periodic flag",
			ft: featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStateCompressed,
				featuremgmt.FlagAlertingSaveStatePeriodic,
			),
			expectedInstanceStoreType: store.ProtoInstanceDBStore{},
		},
		{
			name:                      "Compressed flag disabled",
			ft:                        featuremgmt.WithFeatures(),
			expectedInstanceStoreType: store.InstanceDBStore{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instanceStore, instanceReader := initInstanceStore(sqlStore, logger, tt.ft)
			assert.IsType(t, tt.expectedInstanceStoreType, instanceStore)
			assert.IsType(t, &state.MultiInstanceReader{}, instanceReader)
			assert.IsType(t, store.ProtoInstanceDBStore{}, instanceReader.(*state.MultiInstanceReader).ProtoDBReader)
			assert.IsType(t, store.InstanceDBStore{}, instanceReader.(*state.MultiInstanceReader).DBReader)
		})
	}
}

func TestInitStatePersister(t *testing.T) {
	ua := setting.UnifiedAlertingSettings{
		StatePeriodicSaveInterval: 1 * time.Minute,
	}
	cfg := state.ManagerCfg{}

	tests := []struct {
		name                       string
		ft                         featuremgmt.FeatureToggles
		expectedStatePersisterType state.StatePersister
	}{
		{
			name: "Compressed flag enabled",
			ft: featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStateCompressed,
			),
			expectedStatePersisterType: &state.SyncRuleStatePersister{},
		},
		{
			name: "Periodic flag enabled",
			ft: featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStatePeriodic,
			),
			expectedStatePersisterType: &state.AsyncStatePersister{},
		},
		{
			name:                       "No flags enabled",
			ft:                         featuremgmt.WithFeatures(),
			expectedStatePersisterType: &state.SyncStatePersister{},
		},
		{
			name: "Both flags enabled - compressed takes precedence",
			ft: featuremgmt.WithFeatures(
				featuremgmt.FlagAlertingSaveStateCompressed,
				featuremgmt.FlagAlertingSaveStatePeriodic,
			),
			expectedStatePersisterType: &state.SyncRuleStatePersister{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statePersister := initStatePersister(ua, cfg, tt.ft)
			assert.IsType(t, tt.expectedStatePersisterType, statePersister)
		})
	}
}
