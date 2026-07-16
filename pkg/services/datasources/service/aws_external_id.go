package service

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const (
	grafanaAssumeRoleAuthType         = "grafana_assume_role"
	grafanaExternalIDJSONKey          = "grafanaExternalId"
	usePerDatasourceExternalIDJSONKey = "usePerDatasourceExternalId"
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

// usePerDatasourceExternalID reports whether jsonData sets usePerDatasourceExternalId and its value.
func usePerDatasourceExternalID(jsonData *simplejson.Json) (set bool, enabled bool) {
	if jsonData == nil {
		return false, false
	}
	v, exists := jsonData.CheckGet(usePerDatasourceExternalIDJSONKey)
	if !exists {
		return false, false
	}
	return true, v.MustBool()
}

// clearInvalidGrafanaExternalID removes a client- or store-supplied grafanaExternalId that is
// not bound to this datasource. Scrub always so a stolen or mismatched ID cannot be persisted
// for later STS use when usePerDatasourceExternalId is true.
func clearInvalidGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	if jsonData == nil {
		return
	}
	id := jsonData.Get(grafanaExternalIDJSONKey).MustString()
	if id == "" {
		return
	}
	if !isValidGrafanaExternalID(id, stackExternalID, uid) {
		jsonData.Del(grafanaExternalIDJSONKey)
	}
}

func mintGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	jsonData.Set(grafanaExternalIDJSONKey, buildGrafanaExternalID(stackExternalID, uid))
	// Mode must be true: aws-sdk uses the stack ID when the bool is unset/false, even if an ID is stored.
	jsonData.Set(usePerDatasourceExternalIDJSONKey, true)
}

func awsAssumeRolePerDatasourceExternalIDEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagAwsAssumeRolePerDatasourceExternalId, false, openfeature.TransactionContext(ctx))
}

// ensureGrafanaExternalID scrubs invalid client-supplied grafanaExternalId on create.
// When allowGenerate is true and auth is grafana_assume_role:
//   - usePerDatasourceExternalId=false → stack mode (do not mint; keep a valid dormant ID if present)
//   - true or unset → mint when empty (new datasources default to per-DS)
//
// Valid client-supplied IDs for this stack+uid are kept.
func ensureGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json, allowGenerate bool) {
	if jsonData == nil {
		return
	}

	clearInvalidGrafanaExternalID(uid, stackExternalID, jsonData)

	if !allowGenerate {
		return
	}
	if jsonData.Get("authType").MustString() != grafanaAssumeRoleAuthType {
		return
	}

	modeSet, modeOn := usePerDatasourceExternalID(jsonData)
	if modeSet && !modeOn {
		return
	}

	if stackExternalID == "" || uid == "" {
		return
	}
	if jsonData.Get(grafanaExternalIDJSONKey).MustString() != "" {
		return
	}

	mintGrafanaExternalID(uid, stackExternalID, jsonData)
}

// preserveGrafanaExternalID keeps a valid existing grafanaExternalId across updates.
// Stack vs per-DS mode is controlled by usePerDatasourceExternalId (aws-sdk); switching to
// stack mode does not clear a stored ID. Invalid IDs are always scrubbed.
// When allowGenerate is true it may mint when switching into grafana_assume_role or
// explicitly opting into per-DS mode, unless stack mode is requested.
//
// Omitting usePerDatasourceExternalId / grafanaExternalId on update preserves an existing ID
// (Terraform-friendly). Legacy GAR datasources without an ID stay on the stack ID until they opt in.
func preserveGrafanaExternalID(uid, stackExternalID string, existing, updated *simplejson.Json, allowGenerate bool) {
	if updated == nil {
		return
	}

	// Never persist a stolen / mismatched ID from the update payload.
	clearInvalidGrafanaExternalID(uid, stackExternalID, updated)

	existingID := ""
	existingAuthType := ""
	if existing != nil {
		existingID = existing.Get(grafanaExternalIDJSONKey).MustString()
		existingAuthType = existing.Get("authType").MustString()
	}

	updatedAuthType := updated.Get("authType").MustString()
	modeSet, modeOn := usePerDatasourceExternalID(updated)

	// Leaving Grafana Assume Role: drop the ID when minting is FT-enabled (otherwise leave it).
	if allowGenerate && updatedAuthType != grafanaAssumeRoleAuthType {
		updated.Del(grafanaExternalIDJSONKey)
		return
	}

	if isValidGrafanaExternalID(existingID, stackExternalID, uid) {
		// Keep the value across stack/per-DS toggles; mode is the bool.
		updated.Set(grafanaExternalIDJSONKey, existingID)
		return
	}
	// Invalid/empty stored ID is not re-applied. clearInvalid already removed bad payload
	// values; a valid client correction is left intact for the mint checks below.

	if !allowGenerate {
		return
	}
	if updatedAuthType != grafanaAssumeRoleAuthType {
		return
	}
	if modeSet && !modeOn {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}
	if updated.Get(grafanaExternalIDJSONKey).MustString() != "" {
		return
	}

	// Mint when switching into GAR (bool unset defaults to per-DS) or when explicitly opting in.
	switchingIn := existingAuthType != grafanaAssumeRoleAuthType
	optingIn := modeSet && modeOn
	if !switchingIn && !optingIn {
		return
	}

	mintGrafanaExternalID(uid, stackExternalID, updated)
}
