package service

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

const (
	grafanaAssumeRoleAuthType = "grafana_assume_role"
	grafanaExternalIDJSONKey  = "grafanaExternalId"
)

// buildGrafanaExternalID returns "{stackExternalId}-{dsUID}".
// The stack prefix keeps IDs unique across Cloud stacks (UIDs alone are only unique per org).
// The datasource UID binds the ID to this datasource so a copied ID from another DS fails validation.
func buildGrafanaExternalID(stackExternalID, datasourceUID string) string {
	return stackExternalID + "-" + datasourceUID
}

// isValidGrafanaExternalID reports whether id is bound to this stack + datasource UID.
// Equality is used instead of splitting on "-" because stack IDs and UIDs may contain dashes.
func isValidGrafanaExternalID(id, stackExternalID, datasourceUID string) bool {
	if id == "" || stackExternalID == "" || datasourceUID == "" {
		return false
	}
	return id == buildGrafanaExternalID(stackExternalID, datasourceUID)
}

// ensureGrafanaExternalID sets a per-datasource external ID on create.
// If the client already supplied a valid ID for this stack+UID (pre-save UX), it is kept.
// Otherwise a new ID is generated. Invalid client values are replaced.
// Gated on authType only — plugin allowlists live in enterprise dsauth / aws-sdk-react UI.
func ensureGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	if jsonData == nil {
		return
	}
	if jsonData.Get("authType").MustString() != grafanaAssumeRoleAuthType {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}

	existing := jsonData.Get(grafanaExternalIDJSONKey).MustString()
	if isValidGrafanaExternalID(existing, stackExternalID, uid) {
		return
	}

	jsonData.Set(grafanaExternalIDJSONKey, buildGrafanaExternalID(stackExternalID, uid))
}

// preserveGrafanaExternalID keeps an existing per-datasource external ID
// immutable across updates, and generates one when switching to grafana_assume_role.
// Legacy grafana_assume_role datasources without an ID keep using the stack-level
// fallback until explicitly migrated — we do not generate on ordinary updates.
func preserveGrafanaExternalID(uid, stackExternalID string, existing, updated *simplejson.Json) {
	if updated == nil {
		return
	}

	existingID := ""
	existingAuthType := ""
	if existing != nil {
		existingID = existing.Get(grafanaExternalIDJSONKey).MustString()
		existingAuthType = existing.Get("authType").MustString()
	}
	updatedAuthType := updated.Get("authType").MustString()

	if existingID != "" {
		// Immutable once set.
		updated.Set(grafanaExternalIDJSONKey, existingID)
		return
	}

	if updatedAuthType != grafanaAssumeRoleAuthType {
		return
	}

	// Generate only when switching into grafana_assume_role from another auth type.
	if existingAuthType == grafanaAssumeRoleAuthType {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}

	clientID := updated.Get(grafanaExternalIDJSONKey).MustString()
	if isValidGrafanaExternalID(clientID, stackExternalID, uid) {
		return
	}

	updated.Set(grafanaExternalIDJSONKey, buildGrafanaExternalID(stackExternalID, uid))
}
