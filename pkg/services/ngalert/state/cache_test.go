package state

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/hashicorp/go-multierror"
	"github.com/stretchr/testify/assert"
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

		// TODO: Please update this test in issue https://github.com/grafana/grafana/issues/63686
		var multierr *multierror.Error
		require.True(t, errors.As(err, &multierr))
		require.Equal(t, multierr.Len(), 2)

		errsStr := []string{
			multierr.Errors[0].Error(),
			multierr.Errors[1].Error(),
		}

		firstErrStr := "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}Instance {{ $labels. }} has been down for more than 5 minutes': error parsing template __alert_test: template: __alert_test:1: unexpected <.> in operand"
		secondErrStr := "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}The instance has been down for {{ $value minutes, please check the instance is online': error parsing template __alert_test: template: __alert_test:1: function \"minutes\" not defined"

		require.Contains(t, errsStr, firstErrStr)
		require.Contains(t, errsStr, secondErrStr)

		for _, err := range multierr.Errors {
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

		// TODO: Please update this test in issue https://github.com/grafana/grafana/issues/63686
		var multierr *multierror.Error
		require.True(t, errors.As(err, &multierr))
		require.Equal(t, multierr.Len(), 1)

		// assert each error matches the expected error
		var expandErr template.ExpandError
		require.True(t, errors.As(err, &expandErr))
		require.EqualError(t, expandErr, "failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}The instance has been down for {{ $value minutes, please check the instance is online': error parsing template __alert_test: template: __alert_test:1: function \"minutes\" not defined")
	})
}

func Test_getOrCreate(t *testing.T) {
	url := &url.URL{
		Scheme: "http",
		Host:   "localhost:3000",
		Path:   "/test",
	}
	l := log.New("test")
	c := newCache()

	generateRule := models.AlertRuleGen(models.WithNotEmptyLabels(5, "rule-"))

	t.Run("should combine all labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(5, "extra-")
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		state := c.getOrCreate(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			require.Equal(t, expected, state.Labels[key])
		}
		assert.Len(t, state.Labels, len(extraLabels)+len(rule.Labels)+len(result.Instance))
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range rule.Labels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("extra labels should take precedence over rule and result labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		for key := range extraLabels {
			rule.Labels[key] = "rule-" + util.GenerateShortUID()
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}

		state := c.getOrCreate(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should take precedence over result labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		for key := range rule.Labels {
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}
		state := c.getOrCreate(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range rule.Labels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should be able to be expanded with result and extra labels", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		labelTemplates := make(data.Labels)
		for key := range extraLabels {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Labels = labelTemplates

		state := c.getOrCreate(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Labels["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Labels["rule-"+key])
		}
	})

	t.Run("rule annotations should be able to be expanded with result and extra labels", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}

		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		annotationTemplates := make(data.Labels)
		for key := range extraLabels {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Annotations = annotationTemplates

		state := c.getOrCreate(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
	})

	t.Run("expected Reduce and Math expression values", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
			Values: map[string]eval.NumberValueCapture{
				"A": {Var: "A", Value: util.Pointer(1.0)},
				"B": {Var: "B", Value: util.Pointer(2.0)},
			},
		}
		rule := generateRule()

		state := c.getOrCreate(context.Background(), l, rule, result, nil, url)
		assert.Equal(t, map[string]float64{"A": 1, "B": 2}, state.Values)
	})

	t.Run("expected Classic Condition values", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
			Values: map[string]eval.NumberValueCapture{
				"B0": {Var: "B", Value: util.Pointer(1.0)},
				"B1": {Var: "B", Value: util.Pointer(2.0)},
			},
		}
		rule := generateRule()

		state := c.getOrCreate(context.Background(), l, rule, result, nil, url)
		assert.Equal(t, map[string]float64{"B0": 1, "B1": 2}, state.Values)
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
