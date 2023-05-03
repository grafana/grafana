package historian

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

func TestAnnotationHistorian(t *testing.T) {
	t.Run("alert annotations are queryable", func(t *testing.T) {
		anns := createTestAnnotationBackendSut(t)
		items := []annotations.Item{createAnnotation()}
		require.NoError(t, anns.recordAnnotations(context.Background(), nil, items, 1, log.NewNopLogger()))

		q := models.HistoryQuery{
			RuleUID: "my-rule",
			OrgID:   1,
		}
		frame, err := anns.Query(context.Background(), q)

		require.NoError(t, err)
		require.NotNil(t, frame)
		require.Len(t, frame.Fields, 5)
		for i := 0; i < 5; i++ {
			require.Equal(t, frame.Fields[i].Len(), 1)
		}
	})

	t.Run("writing state transitions as annotations succeeds", func(t *testing.T) {
		anns := createTestAnnotationBackendSut(t)
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State:  eval.Alerting,
			Labels: data.Labels{"a": "b"},
		})

		err := <-anns.Record(context.Background(), rule, states)

		require.NoError(t, err)
	})

	t.Run("emits expected write metrics", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(reg)
		anns := createTestAnnotationBackendSutWithMetrics(t, met)
		errAnns := createFailingAnnotationSut(t, met)
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State:  eval.Alerting,
			Labels: data.Labels{"a": "b"},
		})

		<-anns.Record(context.Background(), rule, states)
		<-errAnns.Record(context.Background(), rule, states)

		exp := bytes.NewBufferString(`
# HELP grafana_alerting_state_history_transitions_failed_total The total number of state transitions that failed to be written - they are not retried.
# TYPE grafana_alerting_state_history_transitions_failed_total counter
grafana_alerting_state_history_transitions_failed_total{org="1"} 1
# HELP grafana_alerting_state_history_transitions_total The total number of state transitions processed.
# TYPE grafana_alerting_state_history_transitions_total counter
grafana_alerting_state_history_transitions_total{org="1"} 2
# HELP grafana_alerting_state_history_writes_failed_total The total number of failed writes of state history batches.
# TYPE grafana_alerting_state_history_writes_failed_total counter
grafana_alerting_state_history_writes_failed_total{backend="annotations",org="1"} 1
# HELP grafana_alerting_state_history_writes_total The total number of state history batches that were attempted to be written.
# TYPE grafana_alerting_state_history_writes_total counter
grafana_alerting_state_history_writes_total{backend="annotations",org="1"} 2
`)
		err := testutil.GatherAndCompare(reg, exp,
			"grafana_alerting_state_history_transitions_total",
			"grafana_alerting_state_history_transitions_failed_total",
			"grafana_alerting_state_history_writes_total",
			"grafana_alerting_state_history_writes_failed_total",
		)
		require.NoError(t, err)

		require.NoError(t, err)
	})
}

func createTestAnnotationBackendSut(t *testing.T) *AnnotationBackend {
	return createTestAnnotationBackendSutWithMetrics(t, metrics.NewHistorianMetrics(prometheus.NewRegistry()))
}

func createTestAnnotationBackendSutWithMetrics(t *testing.T, met *metrics.Historian) *AnnotationBackend {
	t.Helper()
	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.AlertRuleGen(withOrgID(1), withUID("my-rule"))(),
	}
	dbs := &dashboards.FakeDashboardService{}
	dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	return NewAnnotationBackend(fakeAnnoRepo, dbs, rules, met)
}

func createFailingAnnotationSut(t *testing.T, met *metrics.Historian) *AnnotationBackend {
	fakeAnnoRepo := &failingAnnotationRepo{}
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.AlertRuleGen(withOrgID(1), withUID("my-rule"))(),
	}
	dbs := &dashboards.FakeDashboardService{}
	dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	return NewAnnotationBackend(fakeAnnoRepo, dbs, rules, met)
}

func createAnnotation() annotations.Item {
	return annotations.Item{
		ID:      1,
		OrgID:   1,
		AlertID: 1,
		Text:    "MyAlert {a=b} - No data",
		Data:    simplejson.New(),
		Epoch:   time.Now().UnixNano() / int64(time.Millisecond),
	}
}

func withOrgID(orgId int64) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.OrgID = orgId
	}
}

func TestBuildAnnotations(t *testing.T) {
	t.Run("data wraps nil values when values are nil", func(t *testing.T) {
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].State.Values = nil

		items := buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		j := assertValidJSON(t, items[0].Data)
		require.JSONEq(t, `{"values": null}`, j)
	})

	t.Run("data approximately contains expected values", func(t *testing.T) {
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].State.Values = map[string]float64{"a": 1.0, "b": 2.0}

		items := buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		assertValidJSON(t, items[0].Data)
		// Since we're comparing floats, avoid require.JSONEq to avoid intermittency caused by floating point rounding.
		vs := items[0].Data.MustMap()["values"]
		require.NotNil(t, vs)
		vals := vs.(*simplejson.Json).MustMap()
		require.InDelta(t, 1.0, vals["a"], 0.1)
		require.InDelta(t, 2.0, vals["b"], 0.1)
	})

	t.Run("data handles special float values", func(t *testing.T) {
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].State.Values = map[string]float64{"nan": math.NaN(), "inf": math.Inf(1), "ninf": math.Inf(-1)}

		items := buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		j := assertValidJSON(t, items[0].Data)
		require.JSONEq(t, `{"values": {"nan": "NaN", "inf": "+Inf", "ninf": "-Inf"}}`, j)
	})
}

func makeStateTransition() state.StateTransition {
	return state.StateTransition{
		State: &state.State{
			State: eval.Alerting,
		},
		PreviousState: eval.Normal,
	}
}

func withUID(uid string) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.UID = uid
	}
}

func assertValidJSON(t *testing.T, j *simplejson.Json) string {
	require.NotNil(t, j)
	ser, err := json.Marshal(j)
	require.NoError(t, err)
	return string(ser)
}
