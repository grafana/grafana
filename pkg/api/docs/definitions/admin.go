package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
)

// swagger:route GET /admin/settings admin getSettings
//
// Fetch settings.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `settings:read` and scopes: `settings:*`, `settings:auth.saml:` and `settings:auth.saml:enabled` (property level).
//
// Security:
// - basic:
//
// Responses:
// 200: getSettingsResponse
// 401: unauthorisedError
// 403: forbiddenError

// swagger:route GET /admin/stats admin getStats
//
// Fetch Grafana Stats.
//
// Only works with Basic Authentication (username and password). See introduction for an explanation.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `server:stats:read`.
//
// Responses:
// 200: getStatsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /admin/pause-all-alerts admin pauseAllAlerts
//
// Pause/unpause all (legacy) alerts.
//
// Security:
// - basic:
//
// Responses:
// 200: pauseAlertsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters pauseAllAlerts
type PauseAllAlertsParams struct {
	// in:body
	// required:true
	Body dtos.PauseAllAlertsCommand `json:"body"`
}

// swagger:response pauseAlertsResponse
type PauseAllAlertsResponse struct {
	// in:body
	Body struct {
		// AlertsAffected is the number of the affected alerts.
		// required: true
		AlertsAffected int64 `json:"alertsAffected"`
		// required: true
		Message string `json:"message"`
		// Alert result state
		// required true
		State string `json:"state"`
	} `json:"body"`
}
