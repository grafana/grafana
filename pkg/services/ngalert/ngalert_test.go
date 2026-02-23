package ngalert

import (
	"bytes"
	"context"
	"io"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/golang/snappy"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/loki/pkg/push"
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
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
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
		result := make([]fakes.GenericRecordedQuery, 0, len(results))
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
	rules := gen.With(gen.WithOrgID(orgID), gen.WithNamespace(folder1.ToFolderReference())).GenerateManyRef(5)

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

		_, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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

		_, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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

		_, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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
			LokiSettings: setting.UnifiedAlertingLokiSettings{
				// Should never resolve at the DNS level: https://www.rfc-editor.org/rfc/rfc6761#section-6.4
				LokiReadURL:  "http://gone.invalid",
				LokiWriteURL: "http://gone.invalid",
			},
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

		require.NotNil(t, h)
		require.NoError(t, err)
	})

	t.Run("Loki backend sends external labels in Record calls", func(t *testing.T) {
		var receivedRequest *http.Request
		var receivedBody []byte
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedRequest = r
			body, _ := io.ReadAll(r.Body)
			receivedBody = body
			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "loki",
			LokiSettings: setting.UnifiedAlertingLokiSettings{
				LokiReadURL:  server.URL,
				LokiWriteURL: server.URL,
			},
			ExternalLabels: map[string]string{
				"test_label": "test_value",
				"cluster":    "prod",
			},
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, h)

		rule := history_model.RuleMeta{
			OrgID:        1,
			UID:          "test-rule-uid",
			Group:        "test-group",
			NamespaceUID: "test-namespace",
			Title:        "Test Rule",
		}
		states := []state.StateTransition{
			{
				PreviousState: eval.Normal,
				State: &state.State{
					State:              eval.Alerting,
					Labels:             data.Labels{"instance": "test-instance"},
					LastEvaluationTime: time.Now(),
				},
			},
		}

		errCh := h.Record(context.Background(), rule, states)
		err = <-errCh
		require.NoError(t, err)

		require.NotNil(t, receivedRequest, "Expected HTTP request to be sent to Loki")
		require.Contains(t, receivedRequest.URL.Path, "/loki/api/v1/push")

		// Loki uses snappy-compressed protobuf encoding
		decompressed, err := snappy.Decode(nil, receivedBody)
		require.NoError(t, err)

		var req push.PushRequest
		err = proto.Unmarshal(decompressed, &req)
		require.NoError(t, err)

		require.Len(t, req.Streams, 1, "Expected exactly one stream")
		stream := req.Streams[0]

		require.Contains(t, stream.Labels, `test_label="test_value"`)
		require.Contains(t, stream.Labels, `cluster="prod"`)
		require.Contains(t, stream.Labels, `from="state-history"`)
		require.Contains(t, stream.Labels, `orgID="1"`)
	})

	t.Run("fail initialization if prometheus backend missing datasource UID", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "prometheus",
			// Missing PrometheusTargetDatasourceUID
		}
		ac := &acfakes.FakeRuleService{}

		_, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

		require.Error(t, err)
		require.ErrorContains(t, err, "datasource UID must not be empty")
	})

	t.Run("successful initialization of prometheus backend", func(t *testing.T) {
		met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled:                       true,
			Backend:                       "prometheus",
			PrometheusMetricName:          "test_metric",
			PrometheusTargetDatasourceUID: "test-prometheus-uid",
		}
		ac := &acfakes.FakeRuleService{}

		h, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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

		h, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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

		h, err := configureHistorianBackend(context.Background(), cfg, 500, nil, nil, nil, met, logger, tracer, ac, nil, nil, nil, nil, nil)

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

func TestConfigureNotificationHistorian(t *testing.T) {
	t.Run("do not fail initialization if pinging Loki fails", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewNotificationHistorianMetrics(reg)
		logger := log.NewNopLogger()
		tracer := tracing.InitializeTracerForTest()
		ft := featuremgmt.WithFeatures(featuremgmt.FlagAlertingNotificationHistory)
		cfg := setting.UnifiedAlertingNotificationHistorySettings{
			Enabled: true,
			LokiSettings: setting.UnifiedAlertingLokiSettings{
				// Should never resolve at the DNS level: https://www.rfc-editor.org/rfc/rfc6761#section-6.4
				LokiRemoteURL: "http://gone.invalid",
			},
		}

		h, err := configureNotificationHistorian(context.Background(), ft, cfg, met, logger, tracer)
		require.NotNil(t, h)
		require.NoError(t, err)

		// Verify that the metric value is set to 1, indicating that notification history is enabled.
		exp := bytes.NewBufferString(`
# HELP grafana_alerting_notification_history_info Information about the notification history store.
# TYPE grafana_alerting_notification_history_info gauge
grafana_alerting_notification_history_info 1
`)
		err = testutil.GatherAndCompare(reg, exp, "grafana_alerting_notification_history_info")
		require.NoError(t, err)
	})

	t.Run("emit special zero metric if notification history disabled", func(t *testing.T) {
		testCases := []struct {
			name string
			ft   featuremgmt.FeatureToggles
			cfg  setting.UnifiedAlertingNotificationHistorySettings
		}{
			{
				"disabled via config",
				featuremgmt.WithFeatures(featuremgmt.FlagAlertingNotificationHistory),
				setting.UnifiedAlertingNotificationHistorySettings{Enabled: false},
			},
			{
				"disabled via feature toggle",
				featuremgmt.WithFeatures(),
				setting.UnifiedAlertingNotificationHistorySettings{Enabled: true},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				reg := prometheus.NewRegistry()
				met := metrics.NewNotificationHistorianMetrics(reg)
				logger := log.NewNopLogger()
				tracer := tracing.InitializeTracerForTest()
				h, err := configureNotificationHistorian(context.Background(), tc.ft, tc.cfg, met, logger, tracer)
				require.Nil(t, h)
				require.NoError(t, err)

				exp := bytes.NewBufferString(`
# HELP grafana_alerting_notification_history_info Information about the notification history store.
# TYPE grafana_alerting_notification_history_info gauge
grafana_alerting_notification_history_info 0
`)
				err = testutil.GatherAndCompare(reg, exp, "grafana_alerting_notification_history_info")
				require.NoError(t, err)
			})
		}
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
	cfg := state.ManagerCfg{
		StatePeriodicSaveInterval: 1 * time.Minute,
	}

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
			expectedStatePersisterType: &state.AsyncRuleStatePersister{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			statePersister := initStatePersister(ua, cfg, tt.ft)
			assert.IsType(t, tt.expectedStatePersisterType, statePersister)
		})
	}
}
