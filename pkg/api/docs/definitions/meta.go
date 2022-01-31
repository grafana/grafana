// Package api Grafana HTTP API.
//
// The Grafana backend exposes an HTTP API, the same API is used by the frontend to do
// everything from saving dashboards, creating users and updating data sources.
//
// Schemes: http, https
// BasePath: /api
// Version: 0.0.1
// License: GNU Affero General Public License v3.0 https://www.gnu.org/licenses/agpl-3.0.en.html
// Contact: Grafana Labs<hello@grafana.com> https://grafana.com
//
// Consumes:
// - application/json
//
// Produces:
// - application/json
//
// Security:
// - basic:
// - api_key:
//
// SecurityDefinitions:
// basic:
//  type: basic
// api_key:
//  type: apiKey
//  name: Authorization
//  in: header
//
// swagger:meta
package definitions
