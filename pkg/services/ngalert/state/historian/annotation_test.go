package historian

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestAnnotationHistorian(t *testing.T) {
	t.Run("alert annotations are queryable", func(t *testing.T) {
		anns := createTestAnnotationBackendSut(t)
		items := []annotations.Item{createAnnotation()}
		require.NoError(t, anns.store.Save(context.Background(), nil, items, 1, log.NewNopLogger()))

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

	t.Run("alert annotations are authorized", func(t *testing.T) {
		anns := createTestAnnotationBackendSut(t)
		ac := &acfakes.FakeRuleService{}
		expectedErr := errors.New("test-error")
		ac.AuthorizeAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) error {
			return expectedErr
		}
		anns.ac = ac

		items := []annotations.Item{createAnnotation()}
		require.NoError(t, anns.store.Save(context.Background(), nil, items, 1, log.NewNopLogger()))

		q := models.HistoryQuery{
			RuleUID:      "my-rule",
			OrgID:        1,
			SignedInUser: &user.SignedInUser{Name: "test-user", OrgID: 1},
		}
		_, err := anns.Query(context.Background(), q)

		require.ErrorIs(t, err, expectedErr)
		assert.Len(t, ac.Calls, 1)
		assert.Equal(t, "AuthorizeAccessInFolder", ac.Calls[0].MethodName)
		assert.Equal(t, q.SignedInUser, ac.Calls[0].Arguments[1])
	})

	t.Run("annotation queries send expected item query", func(t *testing.T) {
		store := &interceptingAnnotationStore{}
		anns := createTestAnnotationSutWithStore(t, store)
		now := time.Now().UTC()

		q := models.HistoryQuery{
			RuleUID: "my-rule",
			OrgID:   1,
			From:    now.Add(-10 * time.Second),
			To:      now,
		}
		_, err := anns.Query(context.Background(), q)

		require.NoError(t, err)
		query := store.lastQuery
		require.Equal(t, now.UnixMilli(), query.To)
		require.Equal(t, now.Add(-10*time.Second).UnixMilli(), query.From)
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
		met := metrics.NewHistorianMetrics(reg, metrics.Subsystem)
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
	return createTestAnnotationBackendSutWithMetrics(t, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
}

func createTestAnnotationSutWithStore(t *testing.T, annotations AnnotationStore) *AnnotationBackend {
	t.Helper()
	met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.RuleGen.With(models.RuleMuts.WithOrgID(1), withUID("my-rule")).GenerateRef(),
	}
	annotationBackendLogger := log.New("ngalert.state.historian", "backend", "annotations")
	ac := &acfakes.FakeRuleService{}
	return NewAnnotationBackend(annotationBackendLogger, annotations, rules, met, ac, 500)
}

func createTestAnnotationBackendSutWithMetrics(t *testing.T, met *metrics.Historian) *AnnotationBackend {
	t.Helper()
	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.RuleGen.With(models.RuleMuts.WithOrgID(1), withUID("my-rule")).GenerateRef(),
	}
	dbs := &dashboards.FakeDashboardService{}
	dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	store := NewAnnotationStore(fakeAnnoRepo, dbs, met)
	annotationBackendLogger := log.New("ngalert.state.historian", "backend", "annotations")
	ac := &acfakes.FakeRuleService{}
	return NewAnnotationBackend(annotationBackendLogger, store, rules, met, ac, 500)
}

func createFailingAnnotationSut(t *testing.T, met *metrics.Historian) *AnnotationBackend {
	fakeAnnoRepo := &failingAnnotationRepo{}
	rules := fakes.NewRuleStore(t)
	rules.Rules[1] = []*models.AlertRule{
		models.RuleGen.With(models.RuleMuts.WithOrgID(1), withUID("my-rule")).GenerateRef(),
	}
	dbs := &dashboards.FakeDashboardService{}
	dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	annotationBackendLogger := log.New("ngalert.state.historian", "backend", "annotations")
	store := NewAnnotationStore(fakeAnnoRepo, dbs, met)
	ac := &acfakes.FakeRuleService{}
	return NewAnnotationBackend(annotationBackendLogger, store, rules, met, ac, 500)
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

func TestBuildAnnotations(t *testing.T) {
	t.Run("data wraps nil values when values are nil", func(t *testing.T) {
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Values = nil

		items := backend.buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		j := assertValidJSON(t, items[0].Data)
		require.JSONEq(t, `{"values": null}`, j)
	})

	t.Run("data approximately contains expected values", func(t *testing.T) {
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Values = map[string]float64{"a": 1.0, "b": 2.0}

		items := backend.buildAnnotations(rule, states, logger)

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
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Values = map[string]float64{"nan": math.NaN(), "inf": math.Inf(1), "ninf": math.Inf(-1)}

		items := backend.buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		j := assertValidJSON(t, items[0].Data)
		require.JSONEq(t, `{"values": {"nan": "NaN", "inf": "+Inf", "ninf": "-Inf"}}`, j)
	})

	t.Run("tags are populated from alert labels", func(t *testing.T) {
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Labels = data.Labels{
			"severity": "critical",
			"team":     "backend",
			"env":      "production",
		}

		items := backend.buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		require.Len(t, items[0].Tags, 3)
		// Tags should be sorted alphabetically by key
		require.Equal(t, "env:production", items[0].Tags[0])
		require.Equal(t, "severity:critical", items[0].Tags[1])
		require.Equal(t, "team:backend", items[0].Tags[2])
	})

	t.Run("tags filter out private labels", func(t *testing.T) {
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Labels = data.Labels{
			"severity":      "critical",
			"__rule_uid__":  "abc123",
			"__alertname__": "MyAlert",
			"team":          "backend",
		}

		items := backend.buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		require.Len(t, items[0].Tags, 2)
		// Only public labels should be in tags
		require.Equal(t, "severity:critical", items[0].Tags[0])
		require.Equal(t, "team:backend", items[0].Tags[1])
	})

	t.Run("tags are empty when no labels present", func(t *testing.T) {
		backend := createTestAnnotationBackendSut(t)
		logger := log.NewNopLogger()
		rule := history_model.RuleMeta{}
		states := []state.StateTransition{makeStateTransition()}
		states[0].Labels = data.Labels{}

		items := backend.buildAnnotations(rule, states, logger)

		require.Len(t, items, 1)
		require.Nil(t, items[0].Tags)
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

func withUID(uid string) models.AlertRuleMutator {
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

func TestConvertLabelsToTags(t *testing.T) {
	t.Run("converts labels to key:value format", func(t *testing.T) {
		labels := data.Labels{
			"severity": "critical",
			"team":     "backend",
		}

		tags := convertLabelsToTags(labels, 500)

		require.Len(t, tags, 2)
		require.Contains(t, tags, "severity:critical")
		require.Contains(t, tags, "team:backend")
	})

	t.Run("sorts tags alphabetically", func(t *testing.T) {
		labels := data.Labels{
			"z_label": "value1",
			"a_label": "value2",
			"m_label": "value3",
		}

		tags := convertLabelsToTags(labels, 500)

		require.Len(t, tags, 3)
		require.Equal(t, "a_label:value2", tags[0])
		require.Equal(t, "m_label:value3", tags[1])
		require.Equal(t, "z_label:value1", tags[2])
	})

	t.Run("returns nil for empty labels", func(t *testing.T) {
		labels := data.Labels{}

		tags := convertLabelsToTags(labels, 500)

		require.Nil(t, tags)
	})

	t.Run("returns nil for nil labels", func(t *testing.T) {
		var labels data.Labels

		tags := convertLabelsToTags(labels, 500)

		require.Nil(t, tags)
	})

	t.Run("escapes colons in label keys", func(t *testing.T) {
		labels := data.Labels{
			"app:name":    "myapp",
			"service:env": "prod",
		}

		tags := convertLabelsToTags(labels, 500)

		require.Len(t, tags, 2)
		require.Contains(t, tags, "app_name:myapp")
		require.Contains(t, tags, "service_env:prod")
	})

	t.Run("escapes colons in label values", func(t *testing.T) {
		labels := data.Labels{
			"url":  "http://example.com:8080",
			"time": "10:30:00",
		}

		tags := convertLabelsToTags(labels, 500)

		require.Len(t, tags, 2)
		require.Contains(t, tags, "time:10_30_00")
		require.Contains(t, tags, "url:http_//example.com_8080")
	})

	t.Run("escapes colons in both keys and values", func(t *testing.T) {
		labels := data.Labels{
			"app:name": "service:api",
		}

		tags := convertLabelsToTags(labels, 500)

		require.Len(t, tags, 1)
		require.Equal(t, "app_name:service_api", tags[0])
	})

	t.Run("truncates tags when exceeding maxLength", func(t *testing.T) {
		labels := data.Labels{
			"label1": "value1",
			"label2": "value2",
			"label3": "value3",
			"label4": "value4",
		}
		// Calculate: ["label1:value1","label2:value2"] = [" + 14 + " + , + " + 14 + "] = 2+14+1+1+14+1 = 33
		tags := convertLabelsToTags(labels, 35)

		require.LessOrEqual(t, len(tags), 2)
		if len(tags) > 0 {
			require.Equal(t, "label1:value1", tags[0])
		}
	})

	t.Run("returns nil when no tags fit within maxLength", func(t *testing.T) {
		labels := data.Labels{
			"verylonglabel": "verylongvalue",
		}

		tags := convertLabelsToTags(labels, 10)

		require.Nil(t, tags)
	})

	t.Run("tags are parseable by tag.ParseTagPairs", func(t *testing.T) {
		labels := data.Labels{
			"severity":    "critical",
			"app:name":    "myapp",
			"url":         "http://example.com:8080",
			"team":        "backend",
			"__private__": "hidden",
		}

		// Remove private labels first (as done in BuildAnnotationTextAndData)
		publicLabels := removePrivateLabels(labels)
		tags := convertLabelsToTags(publicLabels, 500)

		// Verify tags can be parsed
		parsed := tag.ParseTagPairs(tags)
		require.Len(t, parsed, 4)

		// Verify structure
		for _, p := range parsed {
			require.NotEmpty(t, p.Key)
			// All our tags should have values since we use key:value format
			require.NotEmpty(t, p.Value)
		}
	})
}

type interceptingAnnotationStore struct {
	lastQuery *annotations.ItemQuery
}

func (i *interceptingAnnotationStore) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	i.lastQuery = query
	return []*annotations.ItemDTO{}, nil
}

func (i *interceptingAnnotationStore) Save(ctx context.Context, panel *PanelKey, annotations []annotations.Item, orgID int64, logger log.Logger) error {
	return nil
}
