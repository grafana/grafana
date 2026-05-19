package prometheusrulefile

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
)

func TestValidator_RejectsGroupLimit(t *testing.T) {
	v := NewValidator(config.RuntimeConfig{})

	alert := "X"
	limit := int64(5)
	file := newValidFile()
	file.Spec.Groups[0].Limit = &limit
	file.Spec.Groups[0].Rules = []model.PrometheusRuleFileRuleEntry{{Alert: &alert, Expr: "up"}}

	err := v.Validate(context.Background(), &app.AdmissionRequest{Object: file})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "limit is not supported")
}

func TestValidator_AcceptsZeroLimit(t *testing.T) {
	// Zero (or unset) limit is the default Prometheus value and must be accepted — only
	// an explicit positive value indicates the user is trying to use the unsupported cap.
	v := NewValidator(config.RuntimeConfig{})

	alert := "X"
	zero := int64(0)
	file := newValidFile()
	file.Spec.Groups[0].Limit = &zero
	file.Spec.Groups[0].Rules = []model.PrometheusRuleFileRuleEntry{{Alert: &alert, Expr: "up"}}

	err := v.Validate(context.Background(), &app.AdmissionRequest{Object: file})
	assert.NoError(t, err)
}

// newValidFile returns a PrometheusRuleFile with the bare minimum to pass everything in
// the validator except the field a specific test is exercising.
func newValidFile() *model.PrometheusRuleFile {
	f := model.NewPrometheusRuleFile()
	f.Annotations = map[string]string{model.FolderAnnotationKey: "parent-folder"}
	f.Spec.Groups = []model.PrometheusRuleFilePrometheusRuleGroup{{Name: "g1"}}
	return f
}
