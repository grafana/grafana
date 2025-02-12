package definitions

import (
	"github.com/prometheus/common/model"
)

// swagger:route GET /convert/prometheus/config/v1/rules convert_prometheus RouteConvertPrometheusGetRules
//
// Gets all namespaces with their rule groups in Prometheus format.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// swagger:route GET /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusGetNamespace
//
// Gets rules in prometheus format for a given namespace.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// swagger:route GET /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusGetRuleGroup
//
// Gets a rule group in Prometheus format.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: PrometheusRuleGroup
//       403: ForbiddenError
//       404: NotFound

// swagger:route POST /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusPostRuleGroup
//
// Creates or updates a rule group in Prometheus format.
//
//     Consumes:
//     - application/yaml
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError
//
//     Extensions:
//       x-raw-request: true

// swagger:route DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusDeleteNamespace
//
// Deletes all rule groups in the given namespace.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// swagger:route DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusDeleteRuleGroup
//
// Deletes a rule group in Prometheus format.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// swagger:parameters RouteConvertPrometheusPostRuleGroup
type RouteConvertPrometheusPostRuleGroupParams struct {
	// in: path
	NamespaceTitle string
	// in: header
	DatasourceUID string `json:"x-datasource-uid"`
	// in: header
	RecordingRulesPaused bool `json:"x-recording-rules-paused"`
	// in: header
	AlertRulesPaused bool `json:"x-alert-rules-paused"`
	// in:body
	Body PrometheusRuleGroup
}

// swagger:model
type PrometheusNamespace struct {
	// in: body
	Body map[string][]PrometheusRuleGroup
}

// swagger:model
type PrometheusRuleGroup struct {
	Name     string           `yaml:"name"`
	Interval model.Duration   `yaml:"interval"`
	Rules    []PrometheusRule `yaml:"rules"`
}

// swagger:model
type PrometheusRule struct {
	Alert         string            `yaml:"alert,omitempty"`
	Expr          string            `yaml:"expr"`
	For           *model.Duration   `yaml:"for,omitempty"`
	KeepFiringFor *model.Duration   `yaml:"keep_firing_for,omitempty"`
	Labels        map[string]string `yaml:"labels,omitempty"`
	Annotations   map[string]string `yaml:"annotations,omitempty"`
	Record        string            `yaml:"record,omitempty"`
}

// swagger:parameters RouteConvertPrometheusDeleteRuleGroup RouteConvertPrometheusGetRuleGroup
type RouteConvertPrometheusDeleteRuleGroupParams struct {
	// in: path
	NamespaceTitle string
	// in: path
	Group string
}

// swagger:parameters RouteConvertPrometheusDeleteNamespace RouteConvertPrometheusGetNamespace
type RouteConvertPrometheusDeleteNamespaceParams struct {
	// in: path
	NamespaceTitle string
}

// swagger:model
type ConvertPrometheusResponse struct {
	Status    string `json:"status"`
	ErrorType string `json:"errorType"`
	Error     string `json:"error"`
}
