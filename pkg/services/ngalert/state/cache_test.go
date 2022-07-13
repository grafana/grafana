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
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func Test_getOrCreate(t *testing.T) {
	c := newCache(log.New("test"), &metrics.State{}, &url.URL{
		Scheme: "http",
		Host:   "localhost:3000",
		Path:   "/test",
	})

	generateRule := models.AlertRuleGen(models.WithNotEmptyLabels(5, "rule-"))

	t.Run("should combine all labels", func(t *testing.T) {
		rule := generateRule()

		reservedLabels := make(data.Labels)
		attachRuleLabels(reservedLabels, rule)

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		state := c.getOrCreate(context.Background(), rule, result)
		for key, expected := range reservedLabels {
			require.Equal(t, expected, state.Labels[key])
		}
		assert.Len(t, state.Labels, len(reservedLabels)+len(rule.Labels)+len(result.Instance))
		for key, expected := range reservedLabels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range rule.Labels {
			assert.Equal(t, expected, state.Labels[key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("reserved rule labels should take precedence over rule and result labels", func(t *testing.T) {
		rule := generateRule()

		reservedLabels := make(data.Labels)
		attachRuleLabels(reservedLabels, rule)

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		for key := range reservedLabels {
			rule.Labels[key] = "rule-" + util.GenerateShortUID()
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}
		state := c.getOrCreate(context.Background(), rule, result)
		for key, expected := range reservedLabels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should take precedence over result labels", func(t *testing.T) {
		rule := generateRule()

		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		for key := range rule.Labels {
			result.Instance[key] = "result-" + util.GenerateShortUID()
		}
		state := c.getOrCreate(context.Background(), rule, result)
		for key, expected := range rule.Labels {
			require.Equal(t, expected, state.Labels[key])
		}
	})
	t.Run("rule labels should be able to be expanded with result and reserved labels", func(t *testing.T) {
		result := eval.Result{
			Instance: models.GenerateAlertLabels(5, "result-"),
		}
		rule := generateRule()

		reservedLabels := make(data.Labels)
		attachRuleLabels(reservedLabels, rule)

		labelTemplates := make(data.Labels)
		for key := range reservedLabels {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			labelTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Labels = labelTemplates

		state := c.getOrCreate(context.Background(), rule, result)
		for key, expected := range reservedLabels {
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

		reservedLabels := make(data.Labels)
		attachRuleLabels(reservedLabels, rule)

		annotationTemplates := make(data.Labels)
		for key := range reservedLabels {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		for key := range result.Instance {
			annotationTemplates["rule-"+key] = fmt.Sprintf("{{ with (index .Labels \"%s\") }}{{.}}{{end}}", key)
		}
		rule.Annotations = annotationTemplates

		state := c.getOrCreate(context.Background(), rule, result)
		for key, expected := range reservedLabels {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
		for key, expected := range result.Instance {
			assert.Equal(t, expected, state.Annotations["rule-"+key])
		}
	})
}
