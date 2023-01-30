package state

import (
	"context"
	"fmt"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

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
