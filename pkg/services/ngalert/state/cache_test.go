package state

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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

func Test_create(t *testing.T) {
	url := &url.URL{
		Scheme: "http",
		Host:   "localhost:3000",
		Path:   "/test",
	}
	l := log.New("test")
	c := newCache()

	gen := models.RuleGen
	generateRule := gen.With(gen.WithNotEmptyLabels(5, "rule-")).GenerateRef

	t.Run("should combine all labels", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(5, "extra-")
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		state := c.create(context.Background(), l, rule, result, extraLabels, url)
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

		state := c.create(context.Background(), l, rule, result, extraLabels, url)
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
		state := c.create(context.Background(), l, rule, result, extraLabels, url)
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

		state := c.create(context.Background(), l, rule, result, extraLabels, url)
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

		state := c.create(context.Background(), l, rule, result, extraLabels, url)
		for key, expected := range extraLabels {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
	})
	t.Run("when result labels collide with system labels from LabelsUserCannotSpecify", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		m := models.LabelsUserCannotSpecify
		t.Cleanup(func() {
			models.LabelsUserCannotSpecify = m
		})

		models.LabelsUserCannotSpecify = map[string]struct{}{
			"__label1__": {},
			"label2__":   {},
			"__label3":   {},
			"label4":     {},
		}
		result.Instance["__label1__"] = uuid.NewString()
		result.Instance["label2__"] = uuid.NewString()
		result.Instance["__label3"] = uuid.NewString()
		result.Instance["label4"] = uuid.NewString()

		rule := generateRule()

		state := c.create(context.Background(), l, rule, result, nil, url)

		for key := range models.LabelsUserCannotSpecify {
			assert.NotContains(t, state.Labels, key)
		}
		assert.Contains(t, state.Labels, "label1")
		assert.Equal(t, state.Labels["label1"], result.Instance["__label1__"])

		assert.Contains(t, state.Labels, "label2")
		assert.Equal(t, state.Labels["label2"], result.Instance["label2__"])

		assert.Contains(t, state.Labels, "label3")
		assert.Equal(t, state.Labels["label3"], result.Instance["__label3"])

		assert.Contains(t, state.Labels, "label4_user")
		assert.Equal(t, state.Labels["label4_user"], result.Instance["label4"])

		t.Run("should drop label if renamed collides with existing", func(t *testing.T) {
			result.Instance["label1"] = uuid.NewString()
			result.Instance["label1_user"] = uuid.NewString()
			result.Instance["label4_user"] = uuid.NewString()

			state = c.create(context.Background(), l, rule, result, nil, url)
			assert.NotContains(t, state.Labels, "__label1__")
			assert.Contains(t, state.Labels, "label1")
			assert.Equal(t, state.Labels["label1"], result.Instance["label1"])
			assert.Equal(t, state.Labels["label1_user"], result.Instance["label1_user"])

			assert.NotContains(t, state.Labels, "label4")
			assert.Equal(t, state.Labels["label4_user"], result.Instance["label4_user"])
		})
	})

	t.Run("creates a state with preset fields if there is no current state", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}

		expectedLbl, expectedAnn := expandAnnotationsAndLabels(context.Background(), l, rule, result, extraLabels, url)

		state := c.create(context.Background(), l, rule, result, extraLabels, url)

		assert.Equal(t, rule.OrgID, state.OrgID)
		assert.Equal(t, rule.UID, state.AlertRuleUID)
		assert.Equal(t, state.Labels.Fingerprint(), state.CacheID)
		assert.Equal(t, result.State, state.State)
		assert.Equal(t, "", state.StateReason)
		assert.Equal(t, result.Instance.Fingerprint(), state.ResultFingerprint)
		assert.Nil(t, state.LatestResult)
		assert.Nil(t, state.Error)
		assert.Nil(t, state.Image)
		assert.EqualValues(t, expectedAnn, state.Annotations)
		assert.EqualValues(t, expectedLbl, state.Labels)
		assert.Nil(t, state.Values)
		assert.Equal(t, result.EvaluatedAt, state.StartsAt)
		assert.Equal(t, result.EvaluatedAt, state.EndsAt)
		assert.Nil(t, state.ResolvedAt)
		assert.Nil(t, state.LastSentAt)
		assert.Equal(t, "", state.LastEvaluationString)
		assert.Equal(t, result.EvaluatedAt, state.LastEvaluationTime)
		assert.Equal(t, result.EvaluationDuration, state.EvaluationDuration)
	})

	t.Run("it populates some fields from the current state if it exists", func(t *testing.T) {
		rule := generateRule()

		extraLabels := models.GenerateAlertLabels(2, "extra-")

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}

		expectedLbl, expectedAnn := expandAnnotationsAndLabels(context.Background(), l, rule, result, extraLabels, url)

		current := randomSate(rule.GetKey())
		current.CacheID = expectedLbl.Fingerprint()

		c.set(&current)

		state := c.create(context.Background(), l, rule, result, extraLabels, url)

		assert.Equal(t, rule.OrgID, state.OrgID)
		assert.Equal(t, rule.UID, state.AlertRuleUID)
		assert.Equal(t, state.Labels.Fingerprint(), state.CacheID)
		assert.Equal(t, result.Instance.Fingerprint(), state.ResultFingerprint)
		assert.EqualValues(t, expectedAnn, state.Annotations)
		assert.EqualValues(t, expectedLbl, state.Labels)
		assert.Equal(t, result.EvaluatedAt, state.LastEvaluationTime)
		assert.Equal(t, result.EvaluationDuration, state.EvaluationDuration)

		assert.Equal(t, current.State, state.State)
		assert.Equal(t, current.StateReason, state.StateReason)
		assert.Equal(t, current.Image, state.Image)
		assert.Equal(t, current.LatestResult, state.LatestResult)
		assert.Equal(t, current.Error, state.Error)
		assert.Equal(t, current.Values, state.Values)
		assert.Equal(t, current.StartsAt, state.StartsAt)
		assert.Equal(t, current.EndsAt, state.EndsAt)
		assert.Equal(t, current.ResolvedAt, state.ResolvedAt)
		assert.Equal(t, current.LastSentAt, state.LastSentAt)
		assert.Equal(t, current.LastEvaluationString, state.LastEvaluationString)

		t.Run("if result Error and current state is Error it should copy datasource_uid and ref_id labels", func(t *testing.T) {
			current = randomSate(rule.GetKey())
			current.CacheID = expectedLbl.Fingerprint()
			current.State = eval.Error
			current.Labels["datasource_uid"] = util.GenerateShortUID()
			current.Labels["ref_id"] = util.GenerateShortUID()

			c.set(&current)

			result.State = eval.Error
			state = c.create(context.Background(), l, rule, result, extraLabels, url)

			l := expectedLbl.Copy()
			l["datasource_uid"] = current.Labels["datasource_uid"]
			l["ref_id"] = current.Labels["ref_id"]

			assert.Equal(t, current.CacheID, state.CacheID)
			assert.EqualValues(t, l, state.Labels)

			assert.Equal(t, rule.OrgID, state.OrgID)
			assert.Equal(t, rule.UID, state.AlertRuleUID)

			assert.Equal(t, result.Instance.Fingerprint(), state.ResultFingerprint)
			assert.EqualValues(t, expectedAnn, state.Annotations)
			assert.Equal(t, result.EvaluatedAt, state.LastEvaluationTime)
			assert.Equal(t, result.EvaluationDuration, state.EvaluationDuration)

			assert.Equal(t, current.State, state.State)
			assert.Equal(t, current.StateReason, state.StateReason)
			assert.Equal(t, current.Image, state.Image)
			assert.Equal(t, current.LatestResult, state.LatestResult)
			assert.Equal(t, current.Error, state.Error)
			assert.Equal(t, current.Values, state.Values)
			assert.Equal(t, current.StartsAt, state.StartsAt)
			assert.Equal(t, current.EndsAt, state.EndsAt)
			assert.Equal(t, current.ResolvedAt, state.ResolvedAt)
			assert.Equal(t, current.LastSentAt, state.LastSentAt)
			assert.Equal(t, current.LastEvaluationString, state.LastEvaluationString)
		})
		t.Run("copies system-owned annotations from current state", func(t *testing.T) {
			current = randomSate(rule.GetKey())
			current.CacheID = expectedLbl.Fingerprint()
			current.State = eval.Error
			for key := range models.InternalAnnotationNameSet {
				current.Annotations[key] = util.GenerateShortUID()
			}
			c.set(&current)

			result.State = eval.Error
			state = c.create(context.Background(), l, rule, result, extraLabels, url)
			ann := expectedAnn.Copy()
			for key := range models.InternalAnnotationNameSet {
				ann[key] = current.Annotations[key]
			}
			assert.EqualValues(t, expectedLbl, state.Labels)
			assert.EqualValues(t, ann, state.Annotations)
		})
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
