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

func TestValidator_RejectsUnknownDatasource(t *testing.T) {
	called := false
	cfg := config.RuntimeConfig{
		DatasourceValidator: func(ctx context.Context, uid string) (bool, error) {
			called = true
			assert.Equal(t, "ds-pinned-on-file", uid, "validator should receive the file's spec UID, not the fallback")
			return false, nil
		},
	}
	v := NewValidator(cfg)

	alert := "X"
	ds := model.PrometheusRuleFileDatasourceUID("ds-pinned-on-file")
	file := newValidFile()
	file.Spec.DatasourceUID = &ds
	file.Spec.Groups[0].Rules = []model.PrometheusRuleFileRuleEntry{{Alert: &alert, Expr: "up"}}

	err := v.Validate(context.Background(), &app.AdmissionRequest{Object: file})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "datasource does not exist")
	assert.True(t, called, "DatasourceValidator must be invoked")
}

func TestValidator_DatasourceValidatorOptional(t *testing.T) {
	// With no DatasourceValidator configured (the on-prem fast path), admission proceeds
	// even when the resolved UID falls back to the cloud default. The runtime config
	// supplies whatever check it wants; the validator must not block when none is wired.
	v := NewValidator(config.RuntimeConfig{})

	alert := "X"
	file := newValidFile()
	file.Spec.Groups[0].Rules = []model.PrometheusRuleFileRuleEntry{{Alert: &alert, Expr: "up"}}

	err := v.Validate(context.Background(), &app.AdmissionRequest{Object: file})
	assert.NoError(t, err)
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
