package prom

import (
	prommodel "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrPrometheusRuleValidationFailed      = errutil.ValidationFailed("alerting.prometheusRuleInvalid")
	ErrPrometheusRuleGroupValidationFailed = errutil.ValidationFailed("alerting.prometheusRuleGroupInvalid")
)

type PrometheusRulesFile struct {
	Groups []PrometheusRuleGroup `yaml:"groups"`
}

type PrometheusRuleGroup struct {
	Name        string              `yaml:"name"`
	Interval    prommodel.Duration  `yaml:"interval"`
	QueryOffset *prommodel.Duration `yaml:"query_offset,omitempty"`
	Limit       int                 `yaml:"limit,omitempty"`
	Rules       []PrometheusRule    `yaml:"rules"`
	Labels      map[string]string   `yaml:"labels,omitempty"`
}

func (g *PrometheusRuleGroup) Validate() error {
	if g.Limit != 0 {
		return ErrPrometheusRuleGroupValidationFailed.Errorf("limit is not supported")
	}

	if g.QueryOffset != nil && *g.QueryOffset < prommodel.Duration(0) {
		return ErrPrometheusRuleGroupValidationFailed.Errorf("query_offset must be >= 0")
	}

	return nil
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
