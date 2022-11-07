// Grafana Alerting API.
//
// Package definitions includes the types required for generating or consuming an OpenAPI
// spec for the Grafana Alerting API.
//
//	 Schemes: http, https
//	 BasePath: /api/v1
//	 Version: 1.1.0
//
//	 Consumes:
//	 - application/json
//
//	 Produces:
//	 - application/json
//
//	 Security:
//	 - basic
//
//	SecurityDefinitions:
//	basic:
//	  type: basic
//
// swagger:meta
package definitions

type Backend int

const (
	GrafanaBackend Backend = iota
	AlertmanagerBackend
	LoTexRulerBackend
)

func (b Backend) String() string {
	switch b {
	case GrafanaBackend:
		return "grafana"
	case AlertmanagerBackend:
		return "alertmanager"
	case LoTexRulerBackend:
		return "lotex"
	default:
		return ""
	}
}
