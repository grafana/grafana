package historian

import (
	"context"
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

func TestAnnotationHistorian_Integration(t *testing.T) {
	t.Run("alert annotations are queryable", func(t *testing.T) {
		anns := createTestAnnotationBackendSut(t)
		items := []annotations.Item{createAnnotation()}
		require.NoError(t, anns.recordAnnotationsSync(context.Background(), nil, items, log.NewNopLogger()))

		q := models.HistoryQuery{
			RuleUID: "my-rule",
			OrgID:   1,
		}
		frame, err := anns.QueryStates(context.Background(), q)

		require.NoError(t, err)
		require.NotNil(t, frame)
		require.Len(t, frame.Fields, 5)
		for i := 0; i < 5; i++ {
			require.Equal(t, frame.Fields[i].Len(), 1)
		}
	})
}

func createTestAnnotationBackendSut(t *testing.T) *AnnotationBackend {
	t.Helper()
	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.AlertRuleGen(withOrgID(1), withUID("my-rule"))(),
	}
	return NewAnnotationBackend(fakeAnnoRepo, &dashboards.FakeDashboardService{}, rules)
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
