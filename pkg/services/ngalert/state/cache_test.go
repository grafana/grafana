package state

import (
	"bytes"
	"context"
	"errors"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state/template"
	"github.com/grafana/grafana/pkg/util"
)

func Test_expand(t *testing.T) {
	ctx := context.Background()
	logger := log.NewNopLogger()

	// This test asserts that multierror returns a nil error if there are no errors.
	// If the expand function forgets to use ErrorOrNil() then the error returned will
	// be non-nil even if no errors have been added to the multierror.
	t.Run("err is nil if there are no errors", func(t *testing.T) {
		result, err := expand(ctx, logger, "test", map[string]string{}, template.Data{}, nil, time.Now())
		require.NoError(t, err)
		require.Len(t, result, 0)
	})

	t.Run("original is expanded with template data", func(t *testing.T) {
		original := map[string]string{"Summary": `Instance {{ $labels.instance }} has been down for more than 5 minutes`}
		expected := map[string]string{"Summary": "Instance host1 has been down for more than 5 minutes"}
		data := template.Data{Labels: map[string]string{"instance": "host1"}}
		results, err := expand(ctx, logger, "test", original, data, nil, time.Now())
		require.NoError(t, err)
		require.Equal(t, expected, results)
	})

	t.Run("original is returned with an error", func(t *testing.T) {
		original := map[string]string{
			"Summary": `Instance {{ $labels. }} has been down for more than 5 minutes`,
		}
		data := template.Data{Labels: map[string]string{"instance": "host1"}}
		results, err := expand(ctx, logger, "test", original, data, nil, time.Now())
		require.NotNil(t, err)
		require.Equal(t, original, results)

		// err should be an ExpandError that contains the template for the Summary and an error
		var expandErr template.ExpandError
		require.True(t, errors.As(err, &expandErr))
		require.EqualError(t, expandErr, "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}Instance {{ $labels. }} has been down for more than 5 minutes': error parsing template __alert_test: template: __alert_test:1: unexpected <.> in operand")
	})

	t.Run("originals are returned with two errors", func(t *testing.T) {
		original := map[string]string{
			"Summary":     `Instance {{ $labels. }} has been down for more than 5 minutes`,
			"Description": "The instance has been down for {{ $value minutes, please check the instance is online",
		}
		data := template.Data{Labels: map[string]string{"instance": "host1"}}
		results, err := expand(ctx, logger, "test", original, data, nil, time.Now())
		require.NotNil(t, err)
		require.Equal(t, original, results)

		//nolint:errorlint
		multierr, is := err.(interface{ Unwrap() []error })
		require.True(t, is)
		unwrappedErrors := multierr.Unwrap()
		require.Equal(t, len(unwrappedErrors), 2)

		errsStr := []string{
			unwrappedErrors[0].Error(),
			unwrappedErrors[1].Error(),
		}

		firstErrStr := "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}Instance {{ $labels. }} has been down for more than 5 minutes': error parsing template __alert_test: template: __alert_test:1: unexpected <.> in operand"
		secondErrStr := "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}The instance has been down for {{ $value minutes, please check the instance is online': error parsing template __alert_test: template: __alert_test:1: function \"minutes\" not defined"

		require.Contains(t, errsStr, firstErrStr)
		require.Contains(t, errsStr, secondErrStr)

		for _, err := range unwrappedErrors {
			var expandErr template.ExpandError
			require.True(t, errors.As(err, &expandErr))
		}
	})

	t.Run("expanded and original is returned when there is one error", func(t *testing.T) {
		original := map[string]string{
			"Summary":     `Instance {{ $labels.instance }} has been down for more than 5 minutes`,
			"Description": "The instance has been down for {{ $value minutes, please check the instance is online",
		}
		expected := map[string]string{
			"Summary":     "Instance host1 has been down for more than 5 minutes",
			"Description": "The instance has been down for {{ $value minutes, please check the instance is online",
		}
		data := template.Data{Labels: map[string]string{"instance": "host1"}}
		results, err := expand(ctx, logger, "test", original, data, nil, time.Now())
		require.NotNil(t, err)
		require.Equal(t, expected, results)

		//nolint:errorlint
		multierr, is := err.(interface{ Unwrap() []error })
		require.True(t, is)
		unwrappedErrors := multierr.Unwrap()
		require.Equal(t, len(unwrappedErrors), 1)

		// assert each error matches the expected error
		var expandErr template.ExpandError
		require.True(t, errors.As(err, &expandErr))
		require.EqualError(t, expandErr, "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}The instance has been down for {{ $value minutes, please check the instance is online': error parsing template __alert_test: template: __alert_test:1: function \"minutes\" not defined")
	})
}

func Test_mergeLabels(t *testing.T) {
	t.Run("merges two maps", func(t *testing.T) {
		a := models.GenerateAlertLabels(5, "set1-")
		b := models.GenerateAlertLabels(5, "set2-")

		result := mergeLabels(a, b)
		require.Len(t, result, len(a)+len(b))
		for key, val := range a {
			require.Equal(t, val, result[key])
		}
		for key, val := range b {
			require.Equal(t, val, result[key])
		}
	})
	t.Run("first set take precedence if conflict", func(t *testing.T) {
		a := models.GenerateAlertLabels(5, "set1-")
		b := models.GenerateAlertLabels(5, "set2-")
		c := b.Copy()
		for key, val := range a {
			c[key] = "set2-" + val
		}

		result := mergeLabels(a, c)
		require.Len(t, result, len(a)+len(b))
		for key, val := range a {
			require.Equal(t, val, result[key])
		}
		for key, val := range b {
			require.Equal(t, val, result[key])
		}
	})
}

func TestCacheMetrics(t *testing.T) {
	orgID := int64(1)

	t.Run("should return metrics for all states", func(t *testing.T) {
		states := []*State{
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.Normal,
			},
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.Alerting,
			},
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.Pending,
			},
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.Error,
			},
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.NoData,
			},
			{
				OrgID:        orgID,
				AlertRuleUID: "rule1",
				CacheID:      data.Fingerprint(rand.Int63()),
				State:        eval.Recovering,
			},
		}
		expectedMetrics := `
			# HELP grafana_alerting_alerts How many alerts by state are in the scheduler.
			# TYPE grafana_alerting_alerts gauge
			grafana_alerting_alerts{state="alerting"} 1
			grafana_alerting_alerts{state="error"} 1
			grafana_alerting_alerts{state="nodata"} 1
			grafana_alerting_alerts{state="normal"} 1
			grafana_alerting_alerts{state="pending"} 1
			grafana_alerting_alerts{state="recovering"} 1
		`

		reg := prometheus.NewPedanticRegistry()
		cache := newCache()
		for _, state := range states {
			cache.set(state)
		}

		cache.RegisterMetrics(reg)

		err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetrics), "grafana_alerting_alerts")
		require.NoError(t, err)
	})
}

func randomSate(ruleKey models.AlertRuleKey) State {
	return State{
		OrgID:             ruleKey.OrgID,
		AlertRuleUID:      ruleKey.UID,
		CacheID:           data.Fingerprint(rand.Int63()),
		ResultFingerprint: data.Fingerprint(rand.Int63()),
		State:             eval.Alerting,
		StateReason:       util.GenerateShortUID(),
		LatestResult: &Evaluation{
			EvaluationTime:  time.Time{},
			EvaluationState: eval.Error,
			Values: map[string]float64{
				"A": rand.Float64(),
			},
			Condition: "A",
		},
		Error: errors.New(util.GenerateShortUID()),
		Image: &models.Image{
			ID:    rand.Int63(),
			Token: util.GenerateShortUID(),
		},
		Annotations: models.GenerateAlertLabels(2, "current-"),
		Labels:      models.GenerateAlertLabels(2, "current-"),
		Values: map[string]float64{
			"A": rand.Float64(),
		},
		StartsAt:             randomTimeInPast(),
		EndsAt:               randomTimeInFuture(),
		ResolvedAt:           util.Pointer(randomTimeInPast()),
		LastSentAt:           util.Pointer(randomTimeInPast()),
		LastEvaluationString: util.GenerateShortUID(),
		LastEvaluationTime:   randomTimeInPast(),
		EvaluationDuration:   time.Duration(6000),
	}
}

func TestCache_ForRuleState(t *testing.T) {
	orgID := int64(1)
	ruleUID := "test-rule-uid"
	rule2UID := "test-rule-uid-2"

	cache := newCache()

	states := []*State{
		{
			OrgID:        orgID,
			AlertRuleUID: ruleUID,
			CacheID:      data.Fingerprint(0),
			State:        eval.Normal,
		},
		{
			OrgID:        orgID,
			AlertRuleUID: ruleUID,
			CacheID:      data.Fingerprint(1),
			State:        eval.Alerting,
		},
		{
			OrgID:        orgID,
			AlertRuleUID: ruleUID,
			CacheID:      data.Fingerprint(2),
			State:        eval.Pending,
		},
	}

	for _, state := range states {
		cache.set(state)
	}

	cache.set(&State{
		OrgID:        orgID,
		AlertRuleUID: rule2UID,
		CacheID:      data.Fingerprint(0),
		State:        eval.Pending,
	})

	t.Run("should iterate over all states for rule", func(t *testing.T) {
		var visited []*State
		cache.forRuleState(orgID, ruleUID, func(s *State) {
			visited = append(visited, s)
		})

		require.Len(t, visited, 3)

		visitedCacheIDs := make(map[data.Fingerprint]bool)
		for _, s := range visited {
			visitedCacheIDs[s.CacheID] = true
		}

		for _, expectedState := range states {
			require.True(t, visitedCacheIDs[expectedState.CacheID])
		}
	})

	t.Run("should handle non-existent org", func(t *testing.T) {
		visitCount := 0
		cache.forRuleState(999, ruleUID, func(s *State) {
			visitCount++
		})

		require.Equal(t, 0, visitCount)
	})

	t.Run("should handle non-existent rule", func(t *testing.T) {
		visitCount := 0
		cache.forRuleState(orgID, "non-existent rule", func(s *State) {
			visitCount++
		})

		require.Equal(t, 0, visitCount)
	})
}
