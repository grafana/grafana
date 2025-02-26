package prom

import (
	prommodel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrPrometheusRuleValidationFailed = errutil.ValidationFailed("alerting.prometheusRuleInvalid")
)

type PrometheusRulesFile struct {
	Groups []PrometheusRuleGroup `yaml:"groups"`
}

type PrometheusRuleGroup struct {
	Name     string             `yaml:"name"`
	Interval prommodel.Duration `yaml:"interval"`
	Rules    []PrometheusRule   `yaml:"rules"`
}

type PrometheusRule struct {
	Alert         string              `yaml:"alert,omitempty"`
	Expr          string              `yaml:"expr,omitempty"`
	For           *prommodel.Duration `yaml:"for,omitempty"`
	KeepFiringFor *prommodel.Duration `yaml:"keep_firing_for,omitempty"`
	Labels        map[string]string   `yaml:"labels,omitempty"`
	Annotations   map[string]string   `yaml:"annotations,omitempty"`
	Record        string              `yaml:"record,omitempty"`
}

func (r *PrometheusRule) Validate() error {
	if r.KeepFiringFor != nil {
		return ErrPrometheusRuleValidationFailed.Errorf("keep_firing_for is not supported")
	}

	return nil
}
