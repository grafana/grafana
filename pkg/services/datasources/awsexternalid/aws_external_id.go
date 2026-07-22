package awsexternalid

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	grafanaAssumeRoleAuthType         = "grafana_assume_role"
	grafanaExternalIDJSONKey          = "grafanaExternalId"
	usePerDatasourceExternalIDJSONKey = "usePerDatasourceExternalId"

	// SigV4 datasources (e.g. OpenSearch) that support Grafana Assume Role signal auth via
	// sigV4AuthType rather than authType, and store the per-datasource ID pair under these
	// sigV4-prefixed keys instead of the unprefixed native ones.
	sigV4AuthTypeJSONKey                   = "sigV4AuthType"
	sigV4GrafanaExternalIDJSONKey          = "sigV4GrafanaExternalId"
	sigV4UsePerDatasourceExternalIDJSONKey = "sigV4UsePerDatasourceExternalId"
)

// BeforeSave mints or preserves per-datasource grafanaExternalId on create/update.
// Pass existing=nil on create; pass the stored JsonData on update.
func BeforeSave(ctx context.Context, uid string, cfg *setting.Cfg, existing, jsonData *simplejson.Json) {
	allowGenerate := awsAssumeRolePerDatasourceExternalIDEnabled(ctx)
	stackExternalID := ""
	if cfg != nil {
		stackExternalID = cfg.AWSExternalId
	}
	if existing == nil {
		ensureGrafanaExternalID(uid, stackExternalID, jsonData, allowGenerate)
		return
	}
	preserveGrafanaExternalID(uid, stackExternalID, existing, jsonData, allowGenerate)
}

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

// isGrafanaAssumeRole reports whether jsonData declares Grafana Assume Role auth, either via
// the native authType key or the SigV4-prefixed sigV4AuthType key used by SigV4 datasources
// (e.g. OpenSearch) that support Grafana Assume Role.
func isGrafanaAssumeRole(jsonData *simplejson.Json) bool {
	if jsonData == nil {
		return false
	}
	if jsonData.Get("authType").MustString() == grafanaAssumeRoleAuthType {
		return true
	}
	return jsonData.Get(sigV4AuthTypeJSONKey).MustString() == grafanaAssumeRoleAuthType
}

// externalIDKeys selects the per-datasource ID / mode key pair to operate on, based on
// whether jsonData is on the SigV4 auth path (sigV4AuthType == grafana_assume_role) or the
// native AWS auth path. A nil or non-SigV4-GAR jsonData defaults to the native pair.
func externalIDKeys(jsonData *simplejson.Json) (idKey, modeKey string) {
	if jsonData != nil && jsonData.Get(sigV4AuthTypeJSONKey).MustString() == grafanaAssumeRoleAuthType {
		return sigV4GrafanaExternalIDJSONKey, sigV4UsePerDatasourceExternalIDJSONKey
	}
	return grafanaExternalIDJSONKey, usePerDatasourceExternalIDJSONKey
}

// usePerDatasourceExternalID reports whether jsonData sets its (native or SigV4-prefixed)
// per-datasource mode key and its value.
func usePerDatasourceExternalID(jsonData *simplejson.Json) (set bool, enabled bool) {
	if jsonData == nil {
		return false, false
	}
	_, modeKey := externalIDKeys(jsonData)
	v, exists := jsonData.CheckGet(modeKey)
	if !exists {
		return false, false
	}
	return true, v.MustBool()
}

// clearInvalidGrafanaExternalID removes a client- or store-supplied grafanaExternalId that is
// not bound to this datasource. Scrub when we can validate so a stolen or mismatched ID cannot
// be persisted for later STS use when usePerDatasourceExternalId is true. When stack ID or UID
// is missing we cannot validate, so leave the value alone rather than wiping a previously
// minted ID during misconfiguration.
func clearInvalidGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	if jsonData == nil {
		return
	}
	idKey, _ := externalIDKeys(jsonData)
	id := jsonData.Get(idKey).MustString()
	if id == "" {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}
	if !isValidGrafanaExternalID(id, stackExternalID, uid) {
		jsonData.Del(idKey)
	}
}

func mintGrafanaExternalID(uid, stackExternalID string, jsonData *simplejson.Json) {
	idKey, modeKey := externalIDKeys(jsonData)
	jsonData.Set(idKey, buildGrafanaExternalID(stackExternalID, uid))
	// Mode must be true: aws-sdk uses the stack ID when the bool is unset/false, even if an ID is stored.
	jsonData.Set(modeKey, true)
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
	if !isGrafanaAssumeRole(jsonData) {
		return
	}

	idKey, _ := externalIDKeys(jsonData)
	modeSet, modeOn := usePerDatasourceExternalID(jsonData)
	if modeSet && !modeOn {
		return
	}

	if stackExternalID == "" || uid == "" {
		return
	}
	if jsonData.Get(idKey).MustString() != "" {
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
// Omitting usePerDatasourceExternalId / grafanaExternalId on update preserves existing
// values (Terraform-friendly). The mode bool must be preserved too: aws-sdk only uses the
// per-DS ID when usePerDatasourceExternalId is explicitly true. Legacy GAR datasources
// without an ID stay on the stack ID until they opt in.
func preserveGrafanaExternalID(uid, stackExternalID string, existing, updated *simplejson.Json, allowGenerate bool) {
	if updated == nil {
		return
	}

	// Never persist a stolen / mismatched ID from the update payload.
	clearInvalidGrafanaExternalID(uid, stackExternalID, updated)

	existingIsGAR := isGrafanaAssumeRole(existing)
	existingIdKey, _ := externalIDKeys(existing)
	existingID := ""
	if existing != nil {
		existingID = existing.Get(existingIdKey).MustString()
	}

	updatedIsGAR := isGrafanaAssumeRole(updated)
	idKey, modeKey := externalIDKeys(updated)
	modeSet, modeOn := usePerDatasourceExternalID(updated)

	// Leaving Grafana Assume Role: drop the ID when minting is FT-enabled (otherwise leave it).
	// Once updated's own authType/sigV4AuthType no longer says grafana_assume_role,
	// externalIDKeys(updated) can no longer tell native from SigV4, so the key pair to clear
	// is chosen from the prior (existing) auth path instead.
	if allowGenerate && !updatedIsGAR {
		delKey := idKey
		if existingIsGAR {
			delKey = existingIdKey
		}
		updated.Del(delKey)
		return
	}

	if isValidGrafanaExternalID(existingID, stackExternalID, uid) ||
		(existingID != "" && (stackExternalID == "" || uid == "")) {
		// Keep a validated ID, or any stored ID when we cannot validate (empty stack/uid)
		// so a misconfigured AWSExternalId does not wipe a previously minted value.
		updated.Set(idKey, existingID)
		// When the update omits the mode flag, restore the stored value so Terraform/API
		// updates that only send partial jsonData do not silently fall back to stack ID.
		if !modeSet {
			if existingModeSet, existingModeOn := usePerDatasourceExternalID(existing); existingModeSet {
				updated.Set(modeKey, existingModeOn)
			}
		}
		return
	}
	// Invalid/empty stored ID is not re-applied. clearInvalid already removed bad payload
	// values; a valid client correction is left intact for the mint checks below.

	if !allowGenerate {
		return
	}
	if !updatedIsGAR {
		return
	}
	if modeSet && !modeOn {
		return
	}
	if stackExternalID == "" || uid == "" {
		return
	}
	if updated.Get(idKey).MustString() != "" {
		return
	}

	// Mint when switching into GAR (bool unset defaults to per-DS) or when explicitly opting in.
	switchingIn := !existingIsGAR
	optingIn := modeSet && modeOn
	if !switchingIn && !optingIn {
		return
	}

	mintGrafanaExternalID(uid, stackExternalID, updated)
}
