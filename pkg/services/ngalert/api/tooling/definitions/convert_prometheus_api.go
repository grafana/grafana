package definitions

import (
	"github.com/prometheus/common/model"
)

// Route for mimirtool
// swagger:route GET /convert/prometheus/config/v1/rules convert_prometheus RouteConvertPrometheusGetRules
//
// Gets all Grafana-managed alert rules that were imported from Prometheus-compatible sources, grouped by namespace.
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// Route for cortextool
// swagger:route GET /convert/api/prom/rules convert_prometheus RouteConvertPrometheusCortexGetRules
//
// Gets all Grafana-managed alert rules that were imported from Prometheus-compatible sources, grouped by namespace.
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// Route for mimirtool
// swagger:route GET /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusGetNamespace
//
// Gets Grafana-managed alert rules that were imported from Prometheus-compatible sources for a specified namespace (folder).
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// Route for cortextool
// swagger:route GET /convert/api/prom/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusCortexGetNamespace
//
// Gets Grafana-managed alert rules that were imported from Prometheus-compatible sources for a specified namespace (folder).
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusNamespace
//       403: ForbiddenError
//       404: NotFound

// Route for mimirtool
// swagger:route GET /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusGetRuleGroup
//
// Gets a single rule group in Prometheus-compatible format if it was imported from a Prometheus-compatible source.
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusRuleGroup
//       403: ForbiddenError
//       404: NotFound

// Route for cortextool
// swagger:route GET /convert/api/prom/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusCortexGetRuleGroup
//
// Gets a single rule group in Prometheus-compatible format if it was imported from a Prometheus-compatible source.
//
//     Produces:
//     - application/yaml
//
//     Responses:
//       200: PrometheusRuleGroup
//       403: ForbiddenError
//       404: NotFound

// swagger:route POST /convert/prometheus/config/v1/rules convert_prometheus RouteConvertPrometheusPostRuleGroups
//
// Converts the submitted rule groups into Grafana-Managed Rules.
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// swagger:route POST /convert/api/prom/rules convert_prometheus RouteConvertPrometheusCortexPostRuleGroups
//
// Converts the submitted rule groups into Grafana-Managed Rules.
//
//     Consumes:
//     - application/json
//     - application/yaml
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// Route for mimirtool
// swagger:route POST /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusPostRuleGroup
//
// Converts a Prometheus rule group into a Grafana rule group and creates or updates it within the specified namespace.
// If the group already exists and was not imported from a Prometheus-compatible source initially,
// it will not be replaced and an error will be returned.
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

// Route for cortextool
// swagger:route POST /convert/api/prom/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusCortexPostRuleGroup
//
// Converts a Prometheus rule group into a Grafana rule group and creates or updates it within the specified namespace.
// If the group already exists and was not imported from a Prometheus-compatible source initially,
// it will not be replaced and an error will be returned.
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

// Route for mimirtool
// swagger:route DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusDeleteNamespace
//
// Deletes all rule groups that were imported from Prometheus-compatible sources within the specified namespace.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// Route for cortextool
// swagger:route DELETE /convert/api/prom/rules/{NamespaceTitle} convert_prometheus RouteConvertPrometheusCortexDeleteNamespace
//
// Deletes all rule groups that were imported from Prometheus-compatible sources within the specified namespace.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// Route for mimirtool
// swagger:route DELETE /convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusDeleteRuleGroup
//
// Deletes a specific rule group if it was imported from a Prometheus-compatible source.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// Route for cortextool
// swagger:route DELETE /convert/api/prom/rules/{NamespaceTitle}/{Group} convert_prometheus RouteConvertPrometheusCortexDeleteRuleGroup
//
// Deletes a specific rule group if it was imported from a Prometheus-compatible source.
//
//     Produces:
//     - application/json
//
//     Responses:
//       202: ConvertPrometheusResponse
//       403: ForbiddenError

// swagger:parameters RouteConvertPrometheusPostRuleGroup RouteConvertPrometheusCortexPostRuleGroup
type RouteConvertPrometheusPostRuleGroupParams struct {
	// in: path
	NamespaceTitle string
	// in: header
	DatasourceUID string `json:"x-grafana-alerting-datasource-uid"`
	// in: header
	RecordingRulesPaused bool `json:"x-grafana-alerting-recording-rules-paused"`
	// in: header
	AlertRulesPaused bool `json:"x-grafana-alerting-alert-rules-paused"`
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
	Name        string            `yaml:"name"`
	Interval    model.Duration    `yaml:"interval"`
	QueryOffset *model.Duration   `yaml:"query_offset,omitempty"`
	Limit       int               `yaml:"limit,omitempty"`
	Rules       []PrometheusRule  `yaml:"rules"`
	Labels      map[string]string `yaml:"labels,omitempty"`
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

// swagger:parameters RouteConvertPrometheusDeleteRuleGroup RouteConvertPrometheusCortexDeleteRuleGroup RouteConvertPrometheusGetRuleGroup RouteConvertPrometheusCortexGetRuleGroup
type RouteConvertPrometheusDeleteRuleGroupParams struct {
	// in: path
	NamespaceTitle string
	// in: path
	Group string
}

// swagger:parameters RouteConvertPrometheusDeleteNamespace RouteConvertPrometheusCortexDeleteNamespace RouteConvertPrometheusGetNamespace RouteConvertPrometheusCortexGetNamespace
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
